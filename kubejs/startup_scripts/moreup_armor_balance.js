// priority: 10
// ============================================================
// More Up: 방어구 성능 상향
// 경로: kubejs/startup_scripts/moreup_armor_balance.js
//
// 방식: Forge ItemAttributeModifierEvent 에서 방어구(ArmorItem)의 방어력(generic.armor)과
//       방어 강도(generic.armor_toughness) 더하기(ADDITION) 수정치에 배율을 곱한다.
//       - 바닐라 "Armor modifier"/"Armor toughness"와 Cataclysm 방어구의 "Cataclysm Modifier"처럼
//         UUID가 다른 수정치도 모두 포함한다 (방어구 고유 수치 전체).
//       - 툴팁 숫자도 함께 바뀐다. 이벤트는 매번 원본 수치로 다시 계산되므로 배율이 중복으로 쌓이지 않는다.
//       - 넉백 저항, 곱하기(MULTIPLY_*) 수정치, 큐리오 장신구·마법 부여는 바꾸지 않는다.
//       - 방어구를 입고 스폰하는 몹(좀비 등)도 같은 방어구를 쓰므로 함께 단단해진다.
//
// 이 팩은 Armor Curve가 피해 공식을 바꿔 두었다 (config/armorcurve-common.toml):
//   받는 피해 = 피해 x 15 / (15 + 방어력 + min(피해, 방어 강도)), 최소 10%
//   방어력은 내구도 비율만큼 줄어든다(내구도 50% → 방어력 50%). 상한(20)은 없다.
// 배율을 바꾼 뒤에는 게임/서버를 재시작해야 한다 (startup 스크립트는 /reload 대상 아님).
// ============================================================

// 2026-10-21 사용자 결정: 방어력·방어 강도 모두 2배. 상세 수치는 docs/balance.md "방어구"
const MOREUP_ARMOR_MULTIPLIER = 2.0
const MOREUP_ARMOR_TOUGHNESS_MULTIPLIER = 2.0
// 배율을 걸지 않는 아이템 ID 앞부분 (2026-10-30, More Up Core 성룡 방어구)
const MOREUP_ARMOR_SKIP_PREFIX = 'moreup:star_'

const $MoreUpArmorItem = Java.loadClass('net.minecraft.world.item.ArmorItem')
const $MoreUpArmorModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const $MoreUpArmorOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const $MoreUpArmorAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const $MoreUpArmorSlot = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')

let moreupArmorBalanceErrorCount = 0

// 대상 속성 1개의 ADDITION 수정치를 배율만큼 바꿔 끼운다
function moreupScaleArmorAttribute(event, attribute, multiplier) {
    if (multiplier === 1) return
    let current = event.getModifiers().get(attribute)
    if (current.isEmpty()) return

    // 순회 중에 맵을 바꾸면 ConcurrentModificationException 이 나므로 먼저 복사한다
    let targets = []
    let iterator = current.iterator()
    while (iterator.hasNext()) {
        let modifier = iterator.next()
        if ($MoreUpArmorOperation.ADDITION.equals(modifier.getOperation())) targets.push(modifier)
    }

    for (let i = 0; i < targets.length; i++) {
        let original = targets[i]
        event.removeModifier(attribute, original)
        event.addModifier(attribute, new $MoreUpArmorModifier(
            original.getId(),
            original.getName(),
            original.getAmount() * multiplier,
            original.getOperation()
        ))
    }
}

ForgeEvents.onEvent('net.minecraftforge.event.ItemAttributeModifierEvent', event => {
    try {
        // 가장 싼 검사부터: 손 슬롯이면 바로 종료 (무기 밸런스 스크립트가 처리)
        let slot = event.getSlotType()
        if ($MoreUpArmorSlot.MAINHAND.equals(slot) || $MoreUpArmorSlot.OFFHAND.equals(slot)) return
        let stack = event.getItemStack()
        if (stack.isEmpty() || !(stack.getItem() instanceof $MoreUpArmorItem)) return
        // 1.6 성룡 방어구(More Up Core)는 모드가 최종값(docs/endgame_expansion.md)을 쓰므로 배율을 걸지 않는다
        if (String(stack.getId()).indexOf(MOREUP_ARMOR_SKIP_PREFIX) === 0) return

        moreupScaleArmorAttribute(event, $MoreUpArmorAttributes.ARMOR, MOREUP_ARMOR_MULTIPLIER)
        moreupScaleArmorAttribute(event, $MoreUpArmorAttributes.ARMOR_TOUGHNESS, MOREUP_ARMOR_TOUGHNESS_MULTIPLIER)
    } catch (e) {
        // 이벤트가 매우 자주 호출되므로 로그 폭주를 막기 위해 처음 몇 번만 기록한다
        if (moreupArmorBalanceErrorCount < 5) {
            moreupArmorBalanceErrorCount++
            console.error(`[MoreUp] 방어구 밸런스 처리 실패 (${moreupArmorBalanceErrorCount}/5): ${e}`)
        }
    }
})

console.info(`[MoreUp] 방어구 배율 등록: 방어력 x${MOREUP_ARMOR_MULTIPLIER}, 방어 강도 x${MOREUP_ARMOR_TOUGHNESS_MULTIPLIER}`)
