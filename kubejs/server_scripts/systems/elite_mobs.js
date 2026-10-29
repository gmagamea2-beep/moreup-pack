// priority: -15
// ============================================================
// More Up: 정예 몬스터 (2026-10-28, 1.5.0 "모험의 시간")
// 경로: kubejs/server_scripts/systems/elite_mobs.js   정예 판정: startup_scripts/moreup_elite_spawn.js
//
// 정예로 표시된 몹이 월드에 들어오면 한 번만 강화한다 (청크를 다시 불러와도 두 번 걸리지 않는다).
//   기본: 최대 체력 x3, 공격력 x1.5, 이름 "[정예] <특성> <몹 이름>" (항상 보임)
//   특성 (MOREUP_ELITE_AFFIXES): 강철의·광폭한·날쌘·재생하는·불타는·맹독의·서리의·흡혈하는·폭발하는
//     ("재생하는"은 언데드에도 듣도록 효과 대신 서버 틱에서 2초마다 직접 회복)
//   보상 (플레이어가 처치했을 때): 잠든 정수 2~3 확정, 하급 정수 35%, 중급 정수 6% / 특성 2개면 하급 +1 확정, 중급 15%, 경험치 x2
// 보스 티어표(boss_tiers.js)의 보스와 이름이 있는 몹은 제외한다.
// 관리자 시험: /moreup_elite <특성[,특성]>  (명령을 실행한 몹, 또는 실행한 플레이어 8블록 안의 가장 가까운 몹)
// ============================================================

const MOREUP_ELITE_HEALTH_BONUS = 2.0        // MULTIPLY_TOTAL (+200% = x3)
const MOREUP_ELITE_DAMAGE_BONUS = 0.5        // MULTIPLY_TOTAL (+50% = x1.5)
const MOREUP_ELITE_XP = 30
const MOREUP_ELITE_DURATION = 1000000        // 효과 지속 틱 (사실상 무한)
const MOREUP_ELITE_REGEN_INTERVAL = 40       // "재생하는" 회복 주기 (틱)
const MOREUP_ELITE_REGEN_HEAL = 1            // 주기마다 회복량 (재생 I 과 비슷: 2초에 반 칸)
const MOREUP_ELITE_REGEN_MAX_TRACKED = 512   // 동시에 추적하는 "재생하는" 정예 최대 수

const $EliteAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const $EliteModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const $EliteOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const $EliteUUID = Java.loadClass('java.util.UUID')
const $EliteMob = Java.loadClass('net.minecraft.world.entity.Mob')
const $ElitePlayer = Java.loadClass('net.minecraft.world.entity.player.Player')
const $EliteExplosion = Java.loadClass('net.minecraft.world.level.Level$ExplosionInteraction')

// 고정 UUID: 같은 몹에 두 번 걸리지 않게 하고, 나중에 찾아서 지울 수 있게
const MOREUP_ELITE_UUID = {
    health: $EliteUUID.fromString('4c1e7e2a-7b1d-4e0b-9a51-5e11e7e00001'),
    damage: $EliteUUID.fromString('4c1e7e2a-7b1d-4e0b-9a51-5e11e7e00002'),
    armor: $EliteUUID.fromString('4c1e7e2a-7b1d-4e0b-9a51-5e11e7e00003'),
    knockback: $EliteUUID.fromString('4c1e7e2a-7b1d-4e0b-9a51-5e11e7e00004'),
    speed: $EliteUUID.fromString('4c1e7e2a-7b1d-4e0b-9a51-5e11e7e00005'),
    berserk: $EliteUUID.fromString('4c1e7e2a-7b1d-4e0b-9a51-5e11e7e00006')
}

function moreupEliteModifier(mob, attribute, uuid, name, amount, operation) {
    let inst = mob.getAttribute(attribute)
    if (!inst) return
    if (inst.getModifier(uuid)) inst.removeModifier(uuid)
    inst.addPermanentModifier(new $EliteModifier(uuid, name, amount, operation))
}

function moreupEliteEffect(mob, id, amplifier) {
    mob.potionEffects.add(id, MOREUP_ELITE_DURATION, amplifier, true, false)
}

// "재생하는" 정예 목록: UUID 문자열 → { uuid, dim }. 몹이 죽거나 청크가 언로드되면 다음 회복 주기에 빠지고,
// 청크가 다시 로드되면 EntityEvents.spawned 에서 다시 들어온다
const moreupEliteRegen = {}
let moreupEliteRegenCount = 0
let moreupEliteRegenTimer = 0

function moreupEliteTrackRegen(mob) {
    // KubeJS 6 에서는 getStringUUID()/getUUID() 가 매핑되지 않아 stringUuid / uuid 를 쓴다
    let key = String(mob.stringUuid)
    if (moreupEliteRegen[key] || moreupEliteRegenCount >= MOREUP_ELITE_REGEN_MAX_TRACKED) return
    moreupEliteRegen[key] = { uuid: mob.uuid, dim: String(mob.level.dimension) }
    moreupEliteRegenCount++
}

// 특성: name(이름 앞 말), color(이름 색), apply(강화), hit(정예가 때렸을 때), hurt(정예가 맞았을 때), death(정예가 죽을 때)
const MOREUP_ELITE_AFFIXES = {
    armored: {
        name: '강철의', color: 'gray',
        apply: mob => {
            moreupEliteModifier(mob, $EliteAttributes.ARMOR, MOREUP_ELITE_UUID.armor, 'More Up elite armor', 10, $EliteOperation.ADDITION)
            moreupEliteModifier(mob, $EliteAttributes.KNOCKBACK_RESISTANCE, MOREUP_ELITE_UUID.knockback, 'More Up elite knockback', 0.6, $EliteOperation.ADDITION)
            moreupEliteEffect(mob, 'minecraft:resistance', 0)
        }
    },
    berserk: {
        name: '광폭한', color: 'red',
        apply: mob => moreupEliteModifier(mob, $EliteAttributes.ATTACK_DAMAGE, MOREUP_ELITE_UUID.berserk, 'More Up elite berserk', 0.5, $EliteOperation.MULTIPLY_TOTAL),
        hurt: (mob, attacker, amount) => {
            if (mob.getHealth() - amount < mob.getMaxHealth() * 0.5) mob.potionEffects.add('minecraft:strength', 200, 1, false, true)
        }
    },
    swift: {
        name: '날쌘', color: 'aqua',
        apply: mob => moreupEliteModifier(mob, $EliteAttributes.MOVEMENT_SPEED, MOREUP_ELITE_UUID.speed, 'More Up elite speed', 0.4, $EliteOperation.MULTIPLY_TOTAL)
    },
    // 재생 효과는 언데드(좀비·스켈레톤 등)에 걸리지 않는 바닐라 규칙이 있어서, 효과 대신 주기적으로 직접 회복시킨다
    regenerating: {
        name: '재생하는', color: 'light_purple',
        apply: mob => moreupEliteTrackRegen(mob)
    },
    blazing: {
        name: '불타는', color: 'gold',
        apply: mob => moreupEliteEffect(mob, 'minecraft:fire_resistance', 0),
        hit: (mob, target, amount) => target.setSecondsOnFire(5)
    },
    venom: {
        name: '맹독의', color: 'dark_green',
        hit: (mob, target, amount) => target.potionEffects.add('minecraft:poison', 100, 1, false, true)
    },
    frost: {
        name: '서리의', color: 'blue',
        hit: (mob, target, amount) => target.potionEffects.add('minecraft:slowness', 80, 1, false, true)
    },
    vampiric: {
        name: '흡혈하는', color: 'dark_red',
        hit: (mob, target, amount) => mob.heal(amount * 0.35)
    },
    volatile: {
        name: '폭발하는', color: 'yellow',
        death: mob => mob.level.createExplosion(mob.x, mob.y + 0.5, mob.z).strength(2.5).explosionMode($EliteExplosion.NONE).explode()
    }
}

const moreupEliteBossIds = {}
if (typeof MOREUP_BOSS_TIERS !== 'undefined') {
    for (let tierKey in MOREUP_BOSS_TIERS) MOREUP_BOSS_TIERS[tierKey].forEach(id => { moreupEliteBossIds[id] = true })
}
let moreupEliteErrors = 0
function moreupEliteLog(msg) {
    if (moreupEliteErrors < 10) {
        moreupEliteErrors++
        console.error(`[MoreUp] 정예: ${msg}`)
    }
}

function moreupEliteKeys(mob) {
    let raw = String(mob.persistentData.getString('moreupElite'))
    if (raw === '') return []
    return raw.split(',').filter(k => MOREUP_ELITE_AFFIXES[k])
}

function moreupEliteTypeKey(mob) {
    let id = String(mob.type)
    let i = id.indexOf(':')
    return `entity.${id.substring(0, i)}.${id.substring(i + 1)}`
}

// 강화 적용 (한 번만). 성공하면 true
function moreupEliteApply(mob) {
    let keys = moreupEliteKeys(mob)
    if (keys.length === 0) return false
    if (moreupEliteBossIds[String(mob.type)] || mob.hasCustomName()) {
        mob.persistentData.remove('moreupElite')
        return false
    }
    moreupEliteModifier(mob, $EliteAttributes.MAX_HEALTH, MOREUP_ELITE_UUID.health, 'More Up elite health', MOREUP_ELITE_HEALTH_BONUS, $EliteOperation.MULTIPLY_TOTAL)
    moreupEliteModifier(mob, $EliteAttributes.ATTACK_DAMAGE, MOREUP_ELITE_UUID.damage, 'More Up elite damage', MOREUP_ELITE_DAMAGE_BONUS, $EliteOperation.MULTIPLY_TOTAL)
    mob.setHealth(mob.getMaxHealth())
    let name = Text.gold('[정예] ')
    keys.forEach(k => {
        let a = MOREUP_ELITE_AFFIXES[k]
        if (a.apply) a.apply(mob)
        name.append(Text.of(a.name + ' ').color(a.color))
    })
    name.append(Text.translate(moreupEliteTypeKey(mob)).white())
    mob.setCustomName(name)
    mob.setCustomNameVisible(true)
    mob.persistentData.putBoolean('moreupEliteApplied', true)
    return true
}

EntityEvents.spawned(event => {
    try {
        let mob = event.entity
        if (!(mob instanceof $EliteMob)) return
        let pd = mob.persistentData
        if (!pd.contains('moreupElite')) return
        if (pd.getBoolean('moreupEliteApplied')) {
            // 저장됐다 다시 불러온 정예: 강화·이름은 몹 데이터에 남아 있고, 재생 추적만 다시 건다
            if (moreupEliteKeys(mob).indexOf('regenerating') >= 0) moreupEliteTrackRegen(mob)
            return
        }
        moreupEliteApply(mob)
    } catch (e) {
        moreupEliteLog(`적용 실패 (${event.entity.type}): ${e}`)
    }
})

ServerEvents.tick(event => {
    if (++moreupEliteRegenTimer < MOREUP_ELITE_REGEN_INTERVAL) return
    moreupEliteRegenTimer = 0
    if (moreupEliteRegenCount === 0) return
    try {
        let levels = {}
        event.server.getAllLevels().forEach(l => { levels[String(l.dimension)] = l })
        for (let key in moreupEliteRegen) {
            let entry = moreupEliteRegen[key]
            let level = levels[entry.dim]
            let mob = level ? level.getEntity(entry.uuid) : null
            if (!mob || !mob.isAlive()) {
                delete moreupEliteRegen[key]
                moreupEliteRegenCount--
                continue
            }
            if (mob.getHealth() < mob.getMaxHealth()) mob.heal(MOREUP_ELITE_REGEN_HEAL)
        }
    } catch (e) {
        moreupEliteLog(`재생 처리 실패: ${e}`)
    }
})

EntityEvents.hurt(event => {
    try {
        let victim = event.entity
        let attacker = event.source.getActual()
        // 정예가 때렸을 때
        if (attacker != null && attacker !== victim && attacker.persistentData.getBoolean('moreupEliteApplied')) {
            moreupEliteKeys(attacker).forEach(k => { let a = MOREUP_ELITE_AFFIXES[k]; if (a.hit) a.hit(attacker, victim, event.damage) })
        }
        // 정예가 맞았을 때
        if (victim.persistentData.getBoolean('moreupEliteApplied')) {
            moreupEliteKeys(victim).forEach(k => { let a = MOREUP_ELITE_AFFIXES[k]; if (a.hurt) a.hurt(victim, attacker, event.damage) })
        }
    } catch (e) {
        moreupEliteLog(`피격 처리 실패: ${e}`)
    }
})

EntityEvents.death(event => {
    try {
        let mob = event.entity
        if (!mob.persistentData.getBoolean('moreupEliteApplied')) return
        let keys = moreupEliteKeys(mob)
        moreupEliteReward(mob, keys, event.source.getActual())
        // 보상을 먼저 떨군 뒤 죽을 때 효과(폭발 등). 특성 하나가 실패해도 나머지는 실행한다
        keys.forEach(k => {
            let a = MOREUP_ELITE_AFFIXES[k]
            if (!a.death) return
            try { a.death(mob) } catch (e) { moreupEliteLog(`죽을 때 효과 실패 (${k}): ${e}`) }
        })
    } catch (e) {
        moreupEliteLog(`처치 처리 실패: ${e}`)
    }
})

function moreupEliteReward(mob, keys, killer) {
    try {
        if (killer == null || !(killer instanceof $ElitePlayer)) return
        let server = Utils.server
        if (!server) return
        let double = keys.length >= 2
        // boss_rewards.js 의 드롭 함수 (폭발·용암에 안 사라지고 자동 청소 제외)
        moreupDropItem(server, mob, 'moreup:dormant_essence', 2 + Math.floor(Math.random() * 2))
        if (double || Math.random() < 0.35) moreupDropItem(server, mob, 'moreup:boss_essence_low', 1)
        if (Math.random() < (double ? 0.15 : 0.06)) moreupDropItem(server, mob, 'moreup:boss_essence_mid', 1)
        let xp = MOREUP_ELITE_XP * (double ? 2 : 1)
        server.runCommandSilent(`execute in ${mob.level.dimension} run summon minecraft:experience_orb ${mob.x} ${mob.y + 0.5} ${mob.z} {Value:${xp}}`)
    } catch (e) {
        moreupEliteLog(`처치 보상 실패: ${e}`)
    }
}

// 관리자 시험 명령
ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    event.register(Commands.literal('moreup_elite')
        .requires(src => src.hasPermission(2))
        // 1.5.4: STRING 은 따옴표 없이 쉼표를 못 받아 "blazing,venom" 이 오류였다 → 줄 끝까지 받는 GREEDY_STRING, 쉼표·띄어쓰기 모두 구분자
        .then(Commands.argument('affixes', Arguments.GREEDY_STRING.create(event))
            .executes(ctx => {
                let keys = String(Arguments.GREEDY_STRING.getResult(ctx, 'affixes')).split(/[,\s]+/).filter(k => MOREUP_ELITE_AFFIXES[k])
                if (keys.length === 0) {
                    ctx.source.sendFailure(Text.of(`특성: ${Object.keys(MOREUP_ELITE_AFFIXES).join(', ')}`))
                    return 0
                }
                let target = ctx.source.entity
                if (!(target instanceof $EliteMob)) {
                    let p = ctx.source.player
                    if (!p) return 0
                    let best = null
                    let bestD = 64
                    p.level.getEntitiesWithin(AABB.of(p.x - 8, p.y - 8, p.z - 8, p.x + 8, p.y + 8, p.z + 8)).forEach(e => {
                        if (!(e instanceof $EliteMob)) return
                        let d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) + (e.z - p.z) * (e.z - p.z)
                        if (d < bestD) { bestD = d; best = e }
                    })
                    target = best
                }
                if (!target) {
                    ctx.source.sendFailure(Text.of('8블록 안에 몹이 없습니다'))
                    return 0
                }
                target.persistentData.putString('moreupElite', keys.join(','))
                target.persistentData.remove('moreupEliteApplied')
                let ok = moreupEliteApply(target)
                ctx.source.sendSuccess(() => Text.of(ok ? `정예로 만들었습니다: ${keys.join(', ')}` : '정예로 만들 수 없는 몹입니다 (보스·이름 있는 몹)'), true)
                return ok ? 1 : 0
            })))
})

console.info(`[MoreUp] 정예 몬스터 특성 ${Object.keys(MOREUP_ELITE_AFFIXES).length}종`)
