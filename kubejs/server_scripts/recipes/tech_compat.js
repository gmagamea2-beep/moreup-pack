// priority: 0
// ============================================================
// More Up: 기계 모드 호환 (1.7, 2026-11-02)
// 경로: kubejs/server_scripts/recipes/tech_compat.js
// 설계: MoreUp/docs/tech_expansion.md
//
// - 겹치는 조합법 정리: Thermal 압축 블록·너겟이 Quark·Farmer's Delight·Mekanism 과 같은 모양이라 Thermal 쪽을 지운다
// - 재료 태그 통일: 플라스틱·고무를 어느 모드 것이든 서로 쓸 수 있게 한다
// - Create 로 Thermal 합금·압축 철을 만든다 (전기 기계가 없는 초반에도 재료가 막히지 않게)
// - Thermal 압축 다이나모가 다른 모드의 연료를 태운다 (연료 모드끼리 이어지게)
// Thermal·PneumaticCraft 가 없으면 전부 건너뛴다.
// ============================================================

const MOREUP_HAS_THERMAL = Platform.isLoaded('thermal')
const MOREUP_HAS_PNC = Platform.isLoaded('pneumaticcraft')

// 같은 모양의 다른 모드 조합법이 이미 있는 것 (테스트 서버 비교, 모양 조합법 14,624개 중 9건)
const MOREUP_COMPAT_REMOVE = [
    'thermal:storage/apple_block', 'thermal:storage/carrot_block', 'thermal:storage/potato_block', 'thermal:storage/beetroot_block',
    'thermal:storage/sugar_cane_block', 'thermal:storage/gunpowder_block', 'thermal:storage/charcoal_block',
    'thermal:storage/netherite_nugget_from_ingot', 'pneumaticcraft:copper_nugget'
]

// [결과, 개수, 재료 목록, 열]  재료는 태그. 비율은 Thermal 유도 제련기와 같게 맞췄다
const MOREUP_CREATE_ALLOYS = [
    ['thermal:bronze_ingot', 4, ['forge:ingots/copper', 'forge:ingots/copper', 'forge:ingots/copper', 'forge:ingots/tin'], 'heated'],
    ['thermal:electrum_ingot', 2, ['forge:ingots/gold', 'forge:ingots/silver'], 'heated'],
    ['thermal:invar_ingot', 3, ['forge:ingots/iron', 'forge:ingots/iron', 'forge:ingots/nickel'], 'heated'],
    ['thermal:constantan_ingot', 2, ['forge:ingots/copper', 'forge:ingots/nickel'], 'heated']
]

// 압축 다이나모 연료: [액체, 1000mB 당 전력]. Thermal 정제 연료(200만 RF)보다 낮게, 만들기 어려운 것일수록 높게 둔다
const MOREUP_COMPRESSION_FUELS = [
    ['industrialforegoing:biofuel', 300000],
    ['pneumaticcraft:biodiesel', 500000],
    ['pneumaticcraft:diesel', 800000],
    ['pneumaticcraft:kerosene', 1100000],
    ['pneumaticcraft:gasoline', 1400000],
    ['pneumaticcraft:lpg', 1700000]
]

ServerEvents.tags('item', event => {
    if (MOREUP_HAS_PNC) event.add('forge:plastic', 'pneumaticcraft:plastic')
    if (MOREUP_HAS_THERMAL) {
        event.add('forge:rubber', 'thermal:rubber')
        event.add('forge:rubber', 'thermal:cured_rubber')
    }
})

ServerEvents.recipes(event => {
    if (!MOREUP_HAS_THERMAL && !MOREUP_HAS_PNC) return
    let added = 0
    MOREUP_COMPAT_REMOVE.forEach(id => event.remove({ id: id }))

    if (MOREUP_HAS_THERMAL) {
        MOREUP_CREATE_ALLOYS.forEach(a => {
            try {
                let name = a[0].substring(a[0].indexOf(':') + 1)
                event.custom({
                    type: 'create:mixing',
                    ingredients: a[2].map(t => ({ tag: t })),
                    results: [{ item: a[0], count: a[1] }],
                    heatRequirement: a[3]
                }).id(`moreup:compat/mixing_${name}`)
                added++
            } catch (e) { console.error(`[MoreUp] 합금 레시피 실패 (${a[0]}): ${e}`) }
        })
        MOREUP_COMPRESSION_FUELS.forEach(f => {
            try {
                if (Fluid.of(f[0]).isEmpty()) return
                let name = f[0].substring(f[0].indexOf(':') + 1)
                event.custom({
                    type: 'thermal:compression_fuel',
                    ingredient: { fluid: f[0], amount: 100 },
                    energy: Math.floor(f[1] / 10)
                }).id(`moreup:compat/fuel_${name}`)
                added++
            } catch (e) { console.error(`[MoreUp] 연료 레시피 실패 (${f[0]}): ${e}`) }
        })
    }
    if (MOREUP_HAS_PNC) {
        try {
            event.custom({
                type: 'create:compacting',
                ingredients: [{ tag: 'forge:ingots/iron' }, { tag: 'forge:ingots/iron' }],
                results: [{ item: 'pneumaticcraft:ingot_iron_compressed' }],
                heatRequirement: 'heated'
            }).id('moreup:compat/compacting_compressed_iron')
            added++
        } catch (e) { console.error(`[MoreUp] 압축 철 레시피 실패: ${e}`) }
    }
    console.info(`[MoreUp] 기계 호환 레시피 ${added}개 추가, 겹침 ${MOREUP_COMPAT_REMOVE.length}개 제거`)
})
