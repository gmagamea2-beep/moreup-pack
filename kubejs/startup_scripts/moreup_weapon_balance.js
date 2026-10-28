// priority: 10
// ============================================================
// More Up: 무기 공격력 밸런스
// 경로: kubejs/startup_scripts/moreup_weapon_balance.js
//
// 구 CraftTweaker 스크립트(scripts/spartan_weapon_balance.zs)를 KubeJS로 옮긴 것.
// 구 스크립트는 ZenScript 문법 오류("This type has no ~ operator")와 잘못된 아이템 ID
// (예: forgottennunchakus:*, blooded_*, naga_scale_*) 때문에 한 번도 적용된 적이 없다.
//
// 방식: Forge ItemAttributeModifierEvent 에서 무기 고유 공격력 수정치
//       ("Weapon modifier", Item.BASE_ATTACK_DAMAGE_UUID)에 배율을 곱한다.
//       - 툴팁의 공격력 숫자도 함께 바뀐다.
//       - 근접 공격력만 바뀐다. 투척/사격 피해량은 각 모드 계산식을 따른다.
//       - Spartan Weaponry 자체 설정(spartanweaponry-common.toml, 전 무기 x1.15)에 곱해진다.
//
// 배율을 바꾼 뒤에는 게임/서버를 재시작해야 한다 (startup 스크립트는 /reload 대상 아님).
// ============================================================

// 진행 순서 기준 (최고 실효 DPS, docs/combat_balance.md):
//   피 먹인 드래곤뼈 ~24 < 드래곤스틸 ~27 < Cataclysm 28.8~34 (최종)
// 드래곤스틸은 Ice and Fire 기본 공격력(25)이 원래 매우 높아서, 최종 보스 무기보다 강하지 않게 낮춘다 (2026-10-21).
const MOREUP_WEAPON_DAMAGE_RULES = [
    // pattern: 아이템 ID 정규식, multiplier: 공격력 배율
    { pattern: /^spartancataclysm:(ignitium|cursium|witherite|ancient_metal|black_steel)_/, multiplier: 1.45, note: 'Spartan Cataclysm 전 재질 +45%' },
    // 구 x1.30 → x0.45: 롱소드 실효 DPS 74.9 → 약 27
    { pattern: /^spartanfire:(fire|ice|lightning)_dragonsteel_/, multiplier: 0.45, note: 'Spartan Fire 드래곤스틸 하향 (진행 순서)' },
    // Ice and Fire 원본 드래곤스틸 검·도구: 검 실효 DPS 40 → 약 27.5
    { pattern: /^iceandfire:dragonsteel_(fire|ice|lightning)_(sword|axe|pickaxe|shovel|hoe)$/, multiplier: 0.675, note: 'Ice and Fire 드래곤스틸 하향 (진행 순서)' },
    { pattern: /^spartanfire:(flamed|iced|lightning)_dragon_bone_/, multiplier: 1.20, note: 'Spartan Fire 피 먹인 드래곤본 +20%' },
    { pattern: /^spartantwilight:(fiery|knightmetal|steeleaf|ironwood)_/, multiplier: 1.10, note: 'Spartan Twilight 전 재질 +10%' },
    { pattern: /^fn:[a-z_]+_nunchakus$/, multiplier: 1.35, note: 'Forgotten Nunchakus 전 재질 +35%' }
]

// 바닐라 Item.BASE_ATTACK_DAMAGE_UUID (protected 필드라 스크립트에서 직접 읽을 수 없음)
const MOREUP_BASE_ATTACK_DAMAGE_UUID = Java.loadClass('java.util.UUID').fromString('CB3F55D3-645C-4F38-A497-9C13A33DB5CF')
const $MoreUpAttributeModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const $MoreUpAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const $MoreUpEquipmentSlot = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')

// 아이템 ID → 배율 캐시. 이벤트가 자주 호출되므로 정규식 검사는 아이템 종류당 1회만 한다.
const moreupWeaponMultiplierCache = {}
let moreupWeaponBalanceErrorCount = 0

function moreupWeaponMultiplier(itemId) {
    let cached = moreupWeaponMultiplierCache[itemId]
    if (cached !== undefined) return cached
    let result = 1
    for (let i = 0; i < MOREUP_WEAPON_DAMAGE_RULES.length; i++) {
        if (MOREUP_WEAPON_DAMAGE_RULES[i].pattern.test(itemId)) {
            result = MOREUP_WEAPON_DAMAGE_RULES[i].multiplier
            break
        }
    }
    moreupWeaponMultiplierCache[itemId] = result
    return result
}

ForgeEvents.onEvent('net.minecraftforge.event.ItemAttributeModifierEvent', event => {
    try {
        // 가장 싼 검사부터: 주 손 슬롯이 아니면 바로 종료
        if (!$MoreUpEquipmentSlot.MAINHAND.equals(event.getSlotType())) return
        let stack = event.getItemStack()
        if (stack.isEmpty()) return
        let multiplier = moreupWeaponMultiplier(String(stack.getId()))
        if (multiplier === 1) return

        let attribute = $MoreUpAttributes.ATTACK_DAMAGE
        let current = event.getModifiers().get(attribute)
        if (current.isEmpty()) return

        // 순회 중에 맵을 바꾸면 ConcurrentModificationException 이 나므로 먼저 복사한다
        let targets = []
        let iterator = current.iterator()
        while (iterator.hasNext()) {
            let modifier = iterator.next()
            if (MOREUP_BASE_ATTACK_DAMAGE_UUID.equals(modifier.getId())) targets.push(modifier)
        }

        for (let i = 0; i < targets.length; i++) {
            let original = targets[i]
            event.removeModifier(attribute, original)
            event.addModifier(attribute, new $MoreUpAttributeModifier(
                original.getId(),
                original.getName(),
                original.getAmount() * multiplier,
                original.getOperation()
            ))
        }
    } catch (e) {
        // 이벤트가 매우 자주 호출되므로 로그 폭주를 막기 위해 처음 몇 번만 기록한다
        if (moreupWeaponBalanceErrorCount < 5) {
            moreupWeaponBalanceErrorCount++
            console.error(`[MoreUp] 무기 밸런스 처리 실패 (${moreupWeaponBalanceErrorCount}/5): ${e}`)
        }
    }
})

console.info(`[MoreUp] 무기 공격력 밸런스 규칙 ${MOREUP_WEAPON_DAMAGE_RULES.length}개 등록`)
