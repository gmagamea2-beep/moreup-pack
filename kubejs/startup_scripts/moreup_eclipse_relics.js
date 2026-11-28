// priority: 8
// ============================================================
// More Up: 일식의 장신구 6종 + 전용 Curios 칸 「일식」 (1.14.4, 2026-11-26 사용자 요청 "후반 테크 장신구, 잘 겹치지 않는 걸로")
// 경로: kubejs/startup_scripts/moreup_eclipse_relics.js
// 설계: MoreUp/docs/eclipse_relics.md
//
// - 모어 이후(황혼의 파편 + 전설 보스 정수 + 별의 조각) 장신구. 레시피 server_scripts/recipes/eclipse_relics.js
// - 칸: 이 장신구들만 들어가는 새 칸 「일식」 3개 (kubejs/data/moreup/curios/slots/moreup_eclipse.json, 태그 curios:moreup_eclipse)
//   → 반지·목걸이·부적 같은 기존 칸(세계의 유물·Artifacts·Relics 등)과 자리를 다투지 않는다. 6종 중 3개를 골라 낀다.
// - 효과는 모두 다른 장신구에 없는 방식(보스 특화, 연타 중첩, 피해 저장 후 반격, 처치 폭발, 경험치 방벽, 아군 버프)
// - 같은 장신구 두 개는 겹치지 않는다(착용 여부만 본다).
// - startup 스크립트의 console.error 는 서버 시작을 멈출 수 있어 처리 실패는 console.warn 으로만 남긴다.
// - 시간은 Date.now() (KubeJS 6 에서 level.getGameTime() 을 부를 수 없다 — 2026-11-26 확인)
// 아이템 ID를 바꾸면 이미 만든 아이템이 월드에서 사라지므로 바꾸지 않는다. 수치를 바꾸면 재시작 필요.
// ============================================================

const $MoreUpEcPlayer = Java.loadClass('net.minecraft.world.entity.player.Player')
const $MoreUpEcLiving = Java.loadClass('net.minecraft.world.entity.LivingEntity')
const $MoreUpEcEnemy = Java.loadClass('net.minecraft.world.entity.monster.Enemy')
const $MoreUpEcEffect = Java.loadClass('net.minecraft.world.effect.MobEffectInstance')
const $MoreUpEcEffects = Java.loadClass('net.minecraft.world.effect.MobEffects')
const $MoreUpEcCurios = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
const $MoreUpEcTagKey = Java.loadClass('net.minecraft.tags.TagKey')
const $MoreUpEcRegistries = Java.loadClass('net.minecraft.core.registries.Registries')
const $MoreUpEcRL = Java.loadClass('net.minecraft.resources.ResourceLocation')
const $MoreUpEcParticles = Java.loadClass('net.minecraft.core.particles.ParticleTypes')
const $MoreUpEcSounds = Java.loadClass('net.minecraft.sounds.SoundEvents')
const $MoreUpEcSoundSource = Java.loadClass('net.minecraft.sounds.SoundSource')
const $MoreUpEcForgeRegistries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')

// ---------- 수치 ----------
const MOREUP_ECLIPSE = {
    // 일식의 낙인: 보스에게 주는 피해 x1.2, 보스에게 받는 피해 x0.85
    // 보스 = forge:bosses 엔티티 태그 또는 최대 체력 200 이상
    brandDealt: 1.20, brandTaken: 0.85, bossMinHealth: 200,
    // 연격의 성흔: 같은 대상을 연속으로 때리면 타격마다 +6%, 최대 5중첩(+30%), 3초 안에 다시 안 때리면 초기화
    chainPerStack: 0.06, chainMaxStacks: 5, chainWindowMs: 3000,
    // 응보의 거울: 실제로 받은 피해의 30%를 모아(최대 40) 15초 안의 다음 근접 공격에 더한다
    mirrorRatio: 0.30, mirrorCap: 40, mirrorKeepMs: 15000,
    // 붕괴의 핵: 적을 처치하면 반경 4블록 적에게 처치한 적 최대 체력의 20% 마법 피해 (최소 4, 최대 30)
    coreRadius: 4, coreRatio: 0.20, coreMin: 4, coreMax: 30,
    // 경험의 방벽: 받는 피해의 25%를 경험치로 대신 낸다 (피해 1 = 경험치 2), 경험치가 모자라면 작동 안 함
    wardRatio: 0.25, wardXpPerDamage: 2,
    // 결속의 깃발: 12블록 안에 다른 플레이어가 있으면 착용자와 그 플레이어들에게 저항 I (2초마다 4초씩 갱신)
    bannerRadius: 12, bannerEveryMs: 2000, bannerEffectTicks: 80
}
const MOREUP_ECLIPSE_IDS = ['eclipse_brand', 'eclipse_chain', 'eclipse_mirror', 'eclipse_core', 'eclipse_ward', 'eclipse_banner']
const MOREUP_ECLIPSE_MIRROR_KEY = 'moreupEclipseMirror'       // 저장된 피해 (persistentData, 죽으면 초기화돼도 괜찮은 값)
const MOREUP_ECLIPSE_MIRROR_TIME_KEY = 'moreupEclipseMirrorT'

StartupEvents.registry('item', event => {
    MOREUP_ECLIPSE_IDS.forEach(id => {
        event.create(`moreup:${id}`)
            .texture(`moreup:item/${id}`)   // 생성기 MoreUp/textures_src/draw_eclipse.ps1
            .maxStackSize(1)
            .rarity('epic')
            .fireResistant(true)
            .tooltip(Text.translate(`tooltip.moreup.${id}`).gray())
            .tooltip(Text.translate('tooltip.moreup.eclipse_slot').darkPurple())
    })
})

let moreupEclipseErrorCount = 0
function moreupEclipseWarn(where, e) {
    if (moreupEclipseErrorCount < 10) {
        moreupEclipseErrorCount++
        console.warn(`[MoreUp] 일식의 장신구 처리 실패 (${where}, ${moreupEclipseErrorCount}/10): ${e}`)
    }
}

// 착용 중인 일식 장신구 (플레이어별 1초 캐시, 퇴장 시 삭제) → { eclipse_brand: true, ... }
const moreupEclipseCache = {}
function moreupEclipseWorn(player) {
    let key = String(player.stringUuid)
    let now = Date.now()
    let cached = moreupEclipseCache[key]
    if (cached && now - cached.t < 1000 && now >= cached.t) return cached.v
    let worn = {}
    let opt = $MoreUpEcCurios.getCuriosInventory(player).resolve()
    if (opt.isPresent()) {
        let inv = opt.get().getEquippedCurios()
        for (let i = 0; i < inv.getSlots(); i++) {
            let s = inv.getStackInSlot(i)
            if (s.isEmpty()) continue
            let id = String(s.getId())
            if (id.startsWith('moreup:eclipse_')) worn[id.substring(7)] = true
        }
    }
    moreupEclipseCache[key] = { t: now, v: worn }
    return worn
}

// forge:bosses 태그 엔티티 ID 모음 (1분마다 다시 읽음 — /reload 로 태그가 바뀔 수 있어서)
// KubeJS 6 에서 entity.getType() 은 EntityType 이 아니라 ID 문자열("minecraft:wither")을 돌려주고,
// EntityType#is·builtInRegistryHolder 는 부를 수 없다(2026-11-26 시험 서버) → 태그 멤버의 ID 와 문자열로 비교한다.
let moreupEclipseBossIds = null
let moreupEclipseBossIdsAt = 0
function moreupEclipseIsBoss(entity) {
    if (!(entity instanceof $MoreUpEcLiving) || entity instanceof $MoreUpEcPlayer) return false
    if (entity.getMaxHealth() >= MOREUP_ECLIPSE.bossMinHealth) return true
    try {
        let now = Date.now()
        if (moreupEclipseBossIds == null || now < moreupEclipseBossIdsAt || now - moreupEclipseBossIdsAt > 60000) {
            let ids = {}
            let tag = $MoreUpEcForgeRegistries.ENTITY_TYPES.tags().getTag($MoreUpEcTagKey.create($MoreUpEcRegistries.ENTITY_TYPE, new $MoreUpEcRL('forge', 'bosses')))
            tag.forEach(t => { let k = $MoreUpEcForgeRegistries.ENTITY_TYPES.getKey(t); if (k != null) ids[String(k)] = true })
            moreupEclipseBossIds = ids
            moreupEclipseBossIdsAt = now
        }
        return moreupEclipseBossIds[String(entity.getType())] === true
    } catch (e) {
        moreupEclipseWarn('보스 태그', e)
        return false
    }
}

// 경험치 포인트 (바닐라 공식): 레벨까지 필요한 총량 + 현재 막대
function moreupEclipseXpForLevel(l) {
    if (l <= 16) return l * l + 6 * l
    if (l <= 31) return 2.5 * l * l - 40.5 * l + 360
    return 4.5 * l * l - 162.5 * l + 2220
}
function moreupEclipseXpPoints(player) {
    let level = player.experienceLevel
    return Math.floor(moreupEclipseXpForLevel(level) + player.experienceProgress * player.getXpNeededForNextLevel())
}

// 연격 상태 (플레이어 UUID → { target, stacks, t }), 퇴장 시 삭제
const moreupEclipseChain = {}
// 붕괴의 핵 폭발 피해 중에는 이 파일의 효과를 다시 걸지 않는다 (연쇄 폭발·중복 적용 방지)
let moreupEclipseBusy = false

ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', event => {
    if (moreupEclipseBusy) return
    try {
        let target = event.getEntity()
        if (target.level.isClientSide()) return
        let source = event.getSource()
        let attacker = source.getActual()      // DamageSource#getEntity 는 KubeJS 6 에서 매핑되지 않는다
        let direct = source.getImmediate()
        let amount = event.getAmount()

        // ---- 공격하는 쪽 ----
        if (attacker instanceof $MoreUpEcPlayer && !attacker.equals(target)) {
            let worn = moreupEclipseWorn(attacker)
            let melee = direct != null && attacker.equals(direct)
            if (worn.eclipse_brand && moreupEclipseIsBoss(target)) amount *= MOREUP_ECLIPSE.brandDealt
            if (worn.eclipse_chain && melee) {
                let key = String(attacker.stringUuid)
                let tid = String(target.stringUuid)
                let now = Date.now()
                let st = moreupEclipseChain[key]
                if (st && st.target === tid && now >= st.t && now - st.t <= MOREUP_ECLIPSE.chainWindowMs) {
                    st.stacks = Math.min(st.stacks + 1, MOREUP_ECLIPSE.chainMaxStacks)
                } else {
                    st = { target: tid, stacks: 0 }
                }
                st.t = now
                moreupEclipseChain[key] = st
                amount *= 1 + st.stacks * MOREUP_ECLIPSE.chainPerStack
            }
            if (worn.eclipse_mirror && melee) {
                let data = attacker.persistentData
                let stored = data.contains(MOREUP_ECLIPSE_MIRROR_KEY) ? Number(data.getFloat(MOREUP_ECLIPSE_MIRROR_KEY)) : 0
                if (stored > 0) {
                    let t = Number(data.getLong(MOREUP_ECLIPSE_MIRROR_TIME_KEY))
                    let now = Date.now()
                    data.remove(MOREUP_ECLIPSE_MIRROR_KEY)
                    if (now >= t && now - t <= MOREUP_ECLIPSE.mirrorKeepMs) {
                        amount += stored
                        try { attacker.setStatusMessage(Text.translate('message.moreup.eclipse_mirror', String(Math.round(stored))).lightPurple()) } catch (e2) { }
                    }
                }
            }
        }

        // ---- 맞는 쪽 ----
        if (target instanceof $MoreUpEcPlayer) {
            let worn = moreupEclipseWorn(target)
            if (worn.eclipse_brand && attacker != null && moreupEclipseIsBoss(attacker)) amount *= MOREUP_ECLIPSE.brandTaken
            if (worn.eclipse_ward && amount > 0 && !target.isCreative()) {
                let blocked = amount * MOREUP_ECLIPSE.wardRatio
                let cost = Math.ceil(blocked * MOREUP_ECLIPSE.wardXpPerDamage)
                if (cost > 0 && moreupEclipseXpPoints(target) >= cost) {
                    target.giveExperiencePoints(-cost)
                    amount -= blocked
                }
            }
        }
        event.setAmount(amount)
    } catch (e) {
        moreupEclipseWarn('피해', e)
    }
})

// 응보의 거울: 방어구·흡수 계산 뒤 실제로 깎이는 체력 기준으로 모은다
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDamageEvent', event => {
    if (moreupEclipseBusy) return
    try {
        let player = event.getEntity()
        if (!(player instanceof $MoreUpEcPlayer) || player.level.isClientSide()) return
        if (event.getAmount() <= 0 || !moreupEclipseWorn(player).eclipse_mirror) return
        let data = player.persistentData
        let now = Date.now()
        let stored = data.contains(MOREUP_ECLIPSE_MIRROR_KEY) ? Number(data.getFloat(MOREUP_ECLIPSE_MIRROR_KEY)) : 0
        let t = data.contains(MOREUP_ECLIPSE_MIRROR_TIME_KEY) ? Number(data.getLong(MOREUP_ECLIPSE_MIRROR_TIME_KEY)) : 0
        if (now < t || now - t > MOREUP_ECLIPSE.mirrorKeepMs) stored = 0   // 오래된 것은 버린다
        stored = Math.min(stored + event.getAmount() * MOREUP_ECLIPSE.mirrorRatio, MOREUP_ECLIPSE.mirrorCap)
        data.putFloat(MOREUP_ECLIPSE_MIRROR_KEY, stored)
        data.putLong(MOREUP_ECLIPSE_MIRROR_TIME_KEY, now)
    } catch (e) {
        moreupEclipseWarn('응보 저장', e)
    }
})

// 붕괴의 핵: 처치한 자리에서 폭발 (적대 몹만, 플레이어·동물·마을 주민은 맞지 않는다)
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDeathEvent', event => {
    if (moreupEclipseBusy) return
    try {
        let victim = event.getEntity()
        if (victim.level.isClientSide()) return
        let killer = event.getSource().getActual()
        if (!(killer instanceof $MoreUpEcPlayer) || killer.equals(victim)) return
        if (!moreupEclipseWorn(killer).eclipse_core) return
        let level = victim.level
        let dmg = Math.max(MOREUP_ECLIPSE.coreMin, Math.min(MOREUP_ECLIPSE.coreMax, victim.getMaxHealth() * MOREUP_ECLIPSE.coreRatio))
        let box = victim.getBoundingBox().inflate(MOREUP_ECLIPSE.coreRadius)
        let targets = level.getEntitiesOfClass($MoreUpEcLiving, box)
        let src = level.damageSources().indirectMagic(killer, killer)
        moreupEclipseBusy = true
        try {
            targets.forEach(t => {
                if (t.equals(victim) || !t.isAlive() || !(t instanceof $MoreUpEcEnemy)) return
                t.attack(src, dmg)   // LivingEntity#hurt 는 KubeJS 6 에서 부를 수 없다 → KubeJS attack(피해 원인, 양)
            })
        } finally {
            moreupEclipseBusy = false
        }
        try {
            level.sendParticles($MoreUpEcParticles.EXPLOSION, victim.getX(), victim.getY() + 1, victim.getZ(), 1, 0, 0, 0, 0)
            level.playSound(null, victim.getX(), victim.getY(), victim.getZ(), $MoreUpEcSounds.GENERIC_EXPLODE, $MoreUpEcSoundSource.PLAYERS, 0.5, 1.4)
        } catch (e2) { }
    } catch (e) {
        moreupEclipseBusy = false
        moreupEclipseWarn('붕괴의 핵', e)
    }
})

// 결속의 깃발: bearer 주변의 다른 플레이어(candidates 중)에게 저항 I. 한 명이라도 있으면 착용자도 받는다. 준 인원 수를 돌려준다.
function moreupEclipseApplyBond(bearer, candidates) {
    let r2 = MOREUP_ECLIPSE.bannerRadius * MOREUP_ECLIPSE.bannerRadius
    let count = 0
    candidates.forEach(p => {
        if (p.equals(bearer) || !p.isAlive() || p.isSpectator()) return
        if (!p.level.equals(bearer.level) || p.distanceToSqr(bearer) > r2) return
        p.addEffect(new $MoreUpEcEffect($MoreUpEcEffects.DAMAGE_RESISTANCE, MOREUP_ECLIPSE.bannerEffectTicks, 0, false, true))
        count++
    })
    if (count > 0) bearer.addEffect(new $MoreUpEcEffect($MoreUpEcEffects.DAMAGE_RESISTANCE, MOREUP_ECLIPSE.bannerEffectTicks, 0, false, true))
    return count
}
global.moreupEclipseApplyBond = moreupEclipseApplyBond   // 시험 서버 확인용 (가짜 플레이어는 플레이어 목록에 없어서)

const moreupEclipseBannerLast = {}
ForgeEvents.onEvent('net.minecraftforge.event.TickEvent$PlayerTickEvent', event => {
    try {
        if (String(event.phase) !== 'END') return
        let player = event.player
        if (player.level.isClientSide()) return
        let key = String(player.stringUuid)
        let now = Date.now()
        let last = moreupEclipseBannerLast[key]
        if (last != null && now >= last && now - last < MOREUP_ECLIPSE.bannerEveryMs) return
        moreupEclipseBannerLast[key] = now
        if (!moreupEclipseWorn(player).eclipse_banner) return
        moreupEclipseApplyBond(player, player.getServer().getPlayerList().getPlayers())
    } catch (e) {
        moreupEclipseWarn('결속의 깃발', e)
    }
})

ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerLoggedOutEvent', event => {
    try {
        let key = String(event.getEntity().stringUuid)
        delete moreupEclipseCache[key]
        delete moreupEclipseChain[key]
        delete moreupEclipseBannerLast[key]
    } catch (e) { }
})

console.info(`[MoreUp] 일식의 장신구 ${MOREUP_ECLIPSE_IDS.length}종 등록`)
