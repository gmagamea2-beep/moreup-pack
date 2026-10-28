// priority: 0
// ============================================================
// More Up: 보스 정수 등급 교환 + 자동화 (2026-10-24, 2026-10-26 패치)
// 경로: kubejs/server_scripts/recipes/essence_exchange.js
//
// [교환] 손으로 하는 조합
//   올리기: 같은 등급 4개 → 한 등급 위 1개 (하급 → 중급 → 상급 → 전설)
//   내리기: 한 등급 위 1개 → 아래 등급 3개 (올리기보다 손해라 되팔기로 늘릴 수 없다)
//
// [자동화] 보스와 연결된 Create 생산 라인 (2026-10-26 사용자 요청: 단순 자원 제작 대신)
//   1) 잠든 정수: 철·청금석·레드스톤·금으로 조합 (2개)
//   2) 하급 정수: 기계 손(Deployer)이 "하급 보스 트로피"를 들고 잠든 정수를 누른다. 트로피는 닳지 않는다
//      → 나가를 한 번 잡아 트로피를 얻으면 초반부터 하급 정수를 자동 생산할 수 있다
//   3) 중급 정수: 순서 조립 — 하급 정수에 하급 정수 2개를 더 대고, 중급 보스 트로피를 댄다 (하급 3개 → 중급 1개)
//   4) 상급 정수: 순서 조립 — 중급 정수 3개 + 상급 보스 증표 (엔더 드래곤 머리·네더의 별, 닳지 않음)
//   전설 정수는 자동화하지 않는다 (3~1티어 보스 처치 또는 상급 4개 교환)
//
// 2026-10-24 에 넣었던 "철·금·레드스톤·다이아몬드 → 하급 정수" 조합은 자동화 라인으로 대체해 지웠다.
// ============================================================

const MOREUP_ESSENCE_CHAIN = ['moreup:boss_essence_low', 'moreup:boss_essence_mid', 'moreup:boss_essence_high', 'moreup:boss_essence_legendary']
const MOREUP_ESSENCE_UP_COST = 4
const MOREUP_ESSENCE_DOWN_GAIN = 3

// 기계 손이 들고 있을 보스 증표 (닳지 않음)
const MOREUP_ESSENCE_CATALYSTS = {
    low: ['twilightforest:naga_trophy', 'twilightforest:lich_trophy', 'twilightforest:minoshroom_trophy'],
    mid: ['twilightforest:hydra_trophy', 'twilightforest:knight_phantom_trophy', 'twilightforest:ur_ghast_trophy',
        'twilightforest:alpha_yeti_trophy', 'twilightforest:snow_queen_trophy'],
    high: ['minecraft:dragon_head', 'minecraft:nether_star']
}

ServerEvents.tags('item', event => {
    for (let grade in MOREUP_ESSENCE_CATALYSTS) {
        MOREUP_ESSENCE_CATALYSTS[grade].forEach(id => event.add(`moreup:essence_catalyst/${grade}`, id))
    }
})

ServerEvents.recipes(event => {
    // ---------- 교환 ----------
    for (let i = 0; i < MOREUP_ESSENCE_CHAIN.length - 1; i++) {
        let lower = MOREUP_ESSENCE_CHAIN[i]
        let upper = MOREUP_ESSENCE_CHAIN[i + 1]
        let lowerName = lower.split('_').pop()
        let upperName = upper.split('_').pop()
        let inputs = []
        for (let n = 0; n < MOREUP_ESSENCE_UP_COST; n++) inputs.push(lower)
        event.shapeless(upper, inputs).id(`moreup:essence/${lowerName}_to_${upperName}`)
        event.shapeless(Item.of(lower, MOREUP_ESSENCE_DOWN_GAIN), [upper]).id(`moreup:essence/${upperName}_to_${lowerName}`)
    }

    // ---------- 자동화 ----------
    // 1) 잠든 정수
    event.shaped(Item.of('moreup:dormant_essence', 2), ['ILI', 'RGR', 'ILI'], {
        I: 'minecraft:iron_ingot',
        L: 'minecraft:lapis_lazuli',
        R: 'minecraft:redstone',
        G: 'minecraft:gold_ingot'
    }).id('moreup:essence/dormant')

    // 2) 하급: 기계 손 + 하급 보스 트로피 (트로피 유지)
    event.custom({
        type: 'create:deploying',
        ingredients: [{ item: 'moreup:dormant_essence' }, { tag: 'moreup:essence_catalyst/low' }],
        keepHeldItem: true,
        results: [{ item: 'moreup:boss_essence_low' }]
    }).id('moreup:essence/awaken_low')

    // 3) 중급 / 4) 상급: 순서 조립 (정수 2개를 더 대고, 마지막에 보스 증표를 댄다)
    let assembly = (input, catalystTag, transitional, result, id) => event.custom({
        type: 'create:sequenced_assembly',
        ingredient: { item: input },
        transitionalItem: { item: transitional },
        loops: 1,
        results: [{ item: result }],
        sequence: [
            { type: 'create:deploying', ingredients: [{ item: transitional }, { item: input }], results: [{ item: transitional }] },
            { type: 'create:deploying', ingredients: [{ item: transitional }, { item: input }], results: [{ item: transitional }] },
            { type: 'create:deploying', ingredients: [{ item: transitional }, { tag: catalystTag }], keepHeldItem: true, results: [{ item: transitional }] }
        ]
    }).id(id)
    assembly('moreup:boss_essence_low', 'moreup:essence_catalyst/mid', 'moreup:incomplete_mid_essence', 'moreup:boss_essence_mid', 'moreup:essence/assemble_mid')
    assembly('moreup:boss_essence_mid', 'moreup:essence_catalyst/high', 'moreup:incomplete_high_essence', 'moreup:boss_essence_high', 'moreup:essence/assemble_high')
})
