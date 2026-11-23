// priority: 0
// ============================================================
// More Up: So Many Enchants 기본 능력치 어긋남 보정 (2026-11-21 사용자 요청 "방어도가 - 가 되는 버그 해결")
// 경로: kubejs/server_scripts/systems/sme_attribute_fix.js
//
// 원인 (so_many_enchants-1.20-1.8.0 jar 디스어셈블로 확인):
//   보강(reinforcement)·생명력 강화(health_boost)·단련(temper)·가벼운/무거운 칼날·사거리 인챈트는
//   장비를 낄 때 플레이어 "기본값"(base)에 수치를 더하고, 뺄 때 아이템 NBT(AttributeData)에 적어 둔 수치를 뺀다.
//   접속할 때마다 reset() 으로 한 번 더 빼고 다시 더하는 구조라, 같은 레벨 장비끼리 바꿔 끼기·접속 순서 등에서
//   더하기/빼기 짝이 어긋나면 기본값이 계속 밀린다. (실서버 Gonkor1018: 방어 기본값 -60, 최대 체력 기본값 -16)
//
// 보정: 1초마다 접속 중인 플레이어의 기본값을 "바닐라 기본값 + 지금 낀 장비의 인챈트 효과" 로 다시 맞춘다.
//   - 계산식은 SME 와 같다: 갑옷 4칸(머리·몸·다리·발) / 주 손, 레벨 × 배율, 공격 속도는 -1 이하이면 -0.9
//   - 이 능력치의 기본값을 바꾸는 다른 모드는 없다 (서버 mods 전체 jar 에서 setBaseValue 호출 확인, 2026-11-21)
//     · Baubley Heart Canisters 시작 체력 기능은 world/serverconfig/bhc-server.toml 에서 꺼져 있음
//     · 밀치기 저항(heavy)은 Simply Swords 가 기본값을 잠깐 바꾸므로 건드리지 않는다
//   - 접속·부활·엔드 귀환 직후에는 SME 가 아직 다시 더하는 중일 수 있어 2번(약 2초) 기다린다
//     (새 플레이어 객체인지는 엔티티 번호 getId() 로 본다 — 새 객체마다 새 번호. KubeJS 6 에서 tickCount 는 undefined,
//      java.lang.System 은 클래스 필터로 막힘)
//   - 인챈트 레벨은 SME 자신의 ModEnchantmentHelper.getEnchantmentLevel 로 읽는다 (SME 와 똑같이 판단)
//   - 고친 것은 서버 로그에 "[MoreUp] SME 능력치 보정" 으로 남긴다
// ============================================================

const MOREUP_SME_FIX_INTERVAL = 20      // 몇 틱마다 검사할지 (20 = 1초)
const MOREUP_SME_FIX_WAIT_ROUNDS = 2    // 접속·부활 직후 건너뛸 검사 횟수
const MOREUP_SME_FIX_EPSILON = 0.0001

const $SmeFixDefaultAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.DefaultAttributes')
const $SmeFixEntityType = Java.loadClass('net.minecraft.world.entity.EntityType')
const $SmeFixEquipmentSlot = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')
const $SmeFixForgeRegistries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')
const $SmeFixResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')

// [능력치 ID, 인챈트 ID, 배율, 'armor' | 'hand', SME 설정 필드 이름] — 배율은 SME ArmorEnchantments·WeaponAttributes·ReachEnchantments 와 같음
const MOREUP_SME_FIX_RULES = [
    ['minecraft:generic.armor', 'so_many_enchants:reinforcement', 2.0, 'armor', 'reinforcement'],
    ['minecraft:generic.armor_toughness', 'so_many_enchants:temper', 1.0, 'armor', 'temper'],
    ['minecraft:generic.max_health', 'so_many_enchants:health_boost', 2.0, 'armor', 'healthBoost'],
    ['minecraft:generic.attack_speed', 'so_many_enchants:heavy_blade', -0.1, 'hand', 'heavyBlade'],
    ['minecraft:generic.attack_speed', 'so_many_enchants:light_blade', 0.5, 'hand', 'lightBlade'],
    ['forge:entity_reach', 'so_many_enchants:block_reach', 1.0, 'hand', 'blockReach'],
    ['so_many_enchants:player.attack_distance', 'so_many_enchants:attack_reach', 1.5, 'hand', 'attackReach']
]

let moreupSmeFixTable = null   // 처음 쓸 때 만든다 (레지스트리가 준비된 뒤)
let moreupSmeFixCounter = 0
let moreupSmeFixSeen = {}   // UUID 문자열 → { obj: 플레이어 엔티티 번호, rounds: 그 객체로 지나간 검사 횟수 } (퇴장 시 정리)
let moreupSmeFixHelper = null

function moreupSmeFixEnabled(field) {
    try {
        let cfg = Java.loadClass('com.github.yeetmanlord.somanyenchants.core.config.Config')
        return Boolean(cfg[field].isEnabled.get())
    } catch (e) {
        return true   // 설정을 못 읽으면 SME 기본값(켜짐)으로 본다
    }
}

function moreupSmeFixBuild() {
    let table = {}
    let playerDefaults = $SmeFixDefaultAttributes.getSupplier($SmeFixEntityType.PLAYER)
    MOREUP_SME_FIX_RULES.forEach(rule => {
        let attrId = rule[0]
        let attribute = $SmeFixForgeRegistries.ATTRIBUTES.getValue(new $SmeFixResourceLocation(attrId))
        if (!attribute) {
            console.warn(`[MoreUp] SME 능력치 보정: 능력치 ${attrId} 없음, 건너뜀`)
            return
        }
        if (!table[attrId]) {
            let base
            try {
                base = Number(playerDefaults.getBaseValue(attribute))
            } catch (e) {
                console.warn(`[MoreUp] SME 능력치 보정: 플레이어 기본값을 못 읽음 ${attrId}: ${e}`)
                return
            }
            table[attrId] = { attribute: attribute, base: base, isAttackSpeed: attrId == 'minecraft:generic.attack_speed', parts: [] }
        }
        let enchant = $SmeFixForgeRegistries.ENCHANTMENTS.getValue(new $SmeFixResourceLocation(rule[1]))
        if (!enchant) {
            console.warn(`[MoreUp] SME 능력치 보정: 인챈트 ${rule[1]} 없음, 건너뜀`)
            return
        }
        if (moreupSmeFixEnabled(rule[4])) table[attrId].parts.push({ enchant: enchant, mult: rule[2], where: rule[3] })
    })
    return table
}

// SME 가 쓰는 것과 같은 함수로 레벨을 읽는다 (아이템 NBT 의 Enchantments 목록)
function moreupSmeFixLevel(enchant, stack) {
    if (!stack || stack.isEmpty()) return 0
    if (!moreupSmeFixHelper) moreupSmeFixHelper = Java.loadClass('com.github.yeetmanlord.somanyenchants.core.util.ModEnchantmentHelper')
    return Number(moreupSmeFixHelper.getEnchantmentLevel(enchant, stack))
}

// 플레이어 한 명을 맞춘다. 고친 개수를 돌려준다. (시험에서 직접 부르기 위해 함수로 둔다)
function moreupSmeFixPlayer(player) {
    if (!moreupSmeFixTable) moreupSmeFixTable = moreupSmeFixBuild()
    let armorItems = [$SmeFixEquipmentSlot.HEAD, $SmeFixEquipmentSlot.CHEST, $SmeFixEquipmentSlot.LEGS, $SmeFixEquipmentSlot.FEET].map(slot => player.getItemBySlot(slot))
    let handItems = [player.getItemBySlot($SmeFixEquipmentSlot.MAINHAND)]

    let fixed = 0
    Object.keys(moreupSmeFixTable).forEach(attrId => {
        let entry = moreupSmeFixTable[attrId]
        let instance = player.getAttribute(entry.attribute)
        if (!instance) return
        let expected = entry.base
        entry.parts.forEach(part => {
            let sources = part.where == 'armor' ? armorItems : handItems
            sources.forEach(stack => {
                let lvl = moreupSmeFixLevel(part.enchant, stack)
                if (lvl <= 0) return
                let value = lvl * part.mult
                if (entry.isAttackSpeed && value <= -1.0) value = -0.9   // SME AttributeHelper.apply 와 같은 하한
                expected += value
            })
        })
        let current = Number(instance.getBaseValue())
        if (Math.abs(current - expected) < MOREUP_SME_FIX_EPSILON) return
        instance.setBaseValue(expected)
        fixed++
        console.info(`[MoreUp] SME 능력치 보정: ${player.username} ${attrId} 기본값 ${current.toFixed(3)} → ${expected.toFixed(3)}`)
    })
    if (fixed > 0 && player.getHealth() > player.getMaxHealth()) player.setHealth(player.getMaxHealth())
    return fixed
}

ServerEvents.tick(event => {
    // tick 핸들러 예외는 다른 스크립트의 tick 까지 막으므로 반드시 감싼다
    try {
        moreupSmeFixCounter++
        if (moreupSmeFixCounter < MOREUP_SME_FIX_INTERVAL) return
        moreupSmeFixCounter = 0
        event.server.playerList.players.forEach(player => {
            try {
                if (!player.isAlive()) return
                // 새 플레이어 객체(접속·부활·엔드 귀환)면 SME 가 장비 수치를 다시 더할 때까지 기다린다
                let key = String(player.stringUuid)
                let obj = Number(player.getId())
                let seen = moreupSmeFixSeen[key]
                if (!seen || seen.obj !== obj) {
                    moreupSmeFixSeen[key] = { obj: obj, rounds: 0 }
                    return
                }
                if (seen.rounds < MOREUP_SME_FIX_WAIT_ROUNDS) {
                    seen.rounds++
                    return
                }
                moreupSmeFixPlayer(player)
            } catch (e) {
                console.error(`[MoreUp] SME 능력치 보정 실패 (${player.username}): ${e}`)
            }
        })
    } catch (e) {
        console.error(`[MoreUp] SME 능력치 보정 tick 실패: ${e}`)
    }
})

PlayerEvents.loggedOut(event => {
    try {
        delete moreupSmeFixSeen[String(event.player.stringUuid)]
    } catch (e) {
        console.error(`[MoreUp] SME 능력치 보정 퇴장 정리 실패: ${e}`)
    }
})
