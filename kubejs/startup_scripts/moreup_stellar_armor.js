// priority: 10
// ============================================================
// More Up: 별의 갑주 (모어 이전 최종 방어구, 1.14.4, 2026-11-25 사용자 요청)
// 경로: kubejs/startup_scripts/moreup_stellar_armor.js
// 설계: MoreUp/docs/stellar_armor.md
//
//   여러 보스의 광물·방어구 재료 8종 + 상급 보스 정수 → 별의 조각 1개
//   네더라이트 방어구 + 별의 조각 2개(대장장이 작업대) → 별의 투구·흉갑·각반·장화
//   레시피: server_scripts/recipes/stellar_armor.js / 이름: kubejs/assets/moreup/lang/*.json
//   그림: kubejs/assets/moreup/textures/item/stellar_*.png, textures/models/armor/stellar_layer_*.png
//         (생성기 MoreUp/textures_src/draw_stellar.ps1)
//
// - ID 는 stellar_ 로 시작한다. moreup:star_ 는 성룡 장비(More Up Core)가 쓰고 있고,
//   moreup_armor_balance.js 가 'moreup:star_' 앞부분을 배율 제외로 처리하므로 겹치면 안 된다.
// - 방어구 4부위는 ArmorItem 이라 moreup_armor_balance.js 의 x1.5 가 그대로 곱해진다 (아래 수치는 곱하기 전).
// 아이템 ID를 바꾸면 이미 만든 아이템이 월드에서 사라지므로 바꾸지 않는다. 수치를 바꾸면 재시작 필요.
// ============================================================

// 이름이 "모드ID:이름" 이면 착용 텍스처를 moreup:textures/models/armor/stellar_layer_1.png 에서 찾는다
const MOREUP_STELLAR_ARMOR_TIER = 'moreup:stellar'

// 방어구 (곱하기 전): 투구 10 / 흉갑 18 / 각반 15 / 장화 10 = 53, 방어 강도 부위당 6.5
// x1.5 적용 후 79.5 / 39 → 이그니티움(70.5 / 35.3)·황혼(70.5 / 36)보다 위, 성룡(82 / 42)보다 아래
// (2026-11-25 사용자 결정 "이그니티움보다 확실히 위")
const MOREUP_STELLAR_ARMOR = [
    { id: 'stellar_helmet',     type: 'helmet' },
    { id: 'stellar_chestplate', type: 'chestplate' },
    { id: 'stellar_leggings',   type: 'leggings' },
    { id: 'stellar_boots',      type: 'boots' }
]

ItemEvents.armorTierRegistry(event => {
    event.add(MOREUP_STELLAR_ARMOR_TIER, tier => {
        tier.durabilityMultiplier = 45            // 네더라이트 37, 황혼 45
        tier.slotProtections = [10, 15, 18, 10]   // 장화, 각반, 흉갑, 투구
        tier.enchantmentValue = 18
        tier.equipSound = 'minecraft:item.armor.equip_netherite'
        // 별의 조각으로 고치게 하고 싶지만 이 시점엔 아직 등록 전이라 황혼 장비와 같은 네더라이트 주괴를 쓴다
        tier.repairIngredient = 'minecraft:netherite_ingot'
        tier.toughness = 6.5
        tier.knockbackResistance = 0.15
    })
})

StartupEvents.registry('item', event => {
    event.create('moreup:stellar_shard')
        .texture('moreup:item/stellar_shard')
        .rarity('epic')
        .glow(true)
        .fireResistant(true)
        .tooltip(Text.translate('tooltip.moreup.stellar_shard').gray())

    MOREUP_STELLAR_ARMOR.forEach(a => {
        event.create(`moreup:${a.id}`, a.type)
            .tier(MOREUP_STELLAR_ARMOR_TIER)
            .texture(`moreup:item/${a.id}`)
            .rarity('epic')
            .fireResistant(true)
            .tooltip(Text.translate(`tooltip.moreup.${a.id}`).gray())
            // 세트 효과 설명 (효과 처리는 moreup_stellar_relics.js, 2026-11-26)
            .tooltip(Text.translate('tooltip.moreup.stellar_set_title').aqua())
            .tooltip(Text.translate('tooltip.moreup.stellar_set_stats').darkAqua())
            .tooltip(Text.translate('tooltip.moreup.stellar_set_veil').darkAqua())
    })
})
