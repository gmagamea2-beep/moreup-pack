// priority: 0
// ============================================================
// More Up: 황혼 장비 레시피
// 경로: kubejs/server_scripts/recipes/dusk_gear.js
// 설계: MoreUp/docs/dusk_gear.md / 아이템: startup_scripts/moreup_dusk_gear.js
//
// 모어 1회 처치(플레이어 1명) = 조각 40 + 전설 정수 5 = 황혼의 파편 5개.
// 전체 장비(무기 5 + 방어구 5) = 파편 29개 ≈ 모어 6회. 원하는 장비부터 골라 만든다.
// 재료가 레지스트리에 없으면 그 레시피는 등록하지 않고 오류를 남긴다.
// ============================================================

// F: 황혼의 파편, N: 네더라이트 주괴, R: 블레이즈 막대, S: 실, G: 금 블록, P: 팬텀 막
const MOREUP_DUSK_KEY = {
    F: 'moreup:dusk_fragment',
    N: 'minecraft:netherite_ingot',
    R: 'minecraft:blaze_rod',
    S: 'minecraft:string',
    G: 'minecraft:gold_block',
    P: 'minecraft:phantom_membrane'
}

const MOREUP_DUSK_RECIPES = [
    // 황혼의 파편: 조각 8 + 모어 보상(전설 정수) 1
    { id: 'dusk_fragment', result: 'moreup:dusk_fragment', pattern: ['SSS', 'SES', 'SSS'],
      key: { S: 'moreup:dusk_shard', E: 'moreup:boss_essence_legendary' } },
    // 황혼의 인장(모어 재소환): 첫 소환도 가능하도록 모어 보상이 아닌 재료로 만든다
    { id: 'dusk_sigil', result: 'moreup:dusk_sigil', pattern: ['IHI', 'HNH', 'IHI'],
      key: { I: 'twilightforest:fiery_ingot', H: 'moreup:boss_essence_high', N: 'minecraft:nether_star' } },

    // ---------- 무기 (파편 수) ----------
    { id: 'dusk_sword',      result: 'moreup:dusk_sword',      pattern: [' F ', ' F ', ' R '] },          // 2
    { id: 'dusk_greatsword', result: 'moreup:dusk_greatsword', pattern: [' FF', ' FF', 'R  '] },          // 4
    { id: 'dusk_claw',       result: 'moreup:dusk_claw',       pattern: ['F F', ' N '] },                 // 2
    { id: 'dusk_spear',      result: 'moreup:dusk_spear',      pattern: [' FF', ' RF', 'R  '] },          // 3
    { id: 'dusk_bow',        result: 'moreup:dusk_bow',        pattern: [' FS', 'R S', ' FS'] },          // 2

    // ---------- 방어구 (파편 수) ----------
    { id: 'dusk_crown',   result: 'moreup:dusk_crown',   pattern: ['FGF', 'F F'] },                       // 4
    { id: 'dusk_cape',    result: 'moreup:dusk_cape',    pattern: ['F F', 'PFP', 'PPP'] },                // 3
    { id: 'dusk_cuirass', result: 'moreup:dusk_cuirass', pattern: ['N N', 'FFF', 'FNF'] },                // 4
    { id: 'dusk_greaves', result: 'moreup:dusk_greaves', pattern: ['FNF', 'F F', 'N N'] },                // 3
    { id: 'dusk_boots',   result: 'moreup:dusk_boots',   pattern: ['F F', 'N N'] }                        // 2
]

ServerEvents.recipes(event => {
    let applied = 0
    MOREUP_DUSK_RECIPES.forEach(r => {
        try {
            // 패턴에 쓰인 글자만 키로 넘긴다 (안 쓰는 키가 있으면 레시피 오류)
            let key = {}
            let source = r.key || MOREUP_DUSK_KEY
            r.pattern.join('').split('').forEach(ch => { if (ch !== ' ') key[ch] = source[ch] })
            let missing = []
            for (let k in key) { if (!key[k] || Item.of(key[k]).isEmpty()) missing.push(`${k}=${key[k]}`) }
            if (Item.of(r.result).isEmpty()) missing.push(`결과 ${r.result}`)
            if (missing.length > 0) {
                console.error(`[MoreUp] 황혼 장비 레시피 ${r.id} 재료 없음: ${missing.join(', ')}`)
                return
            }
            event.shaped(r.result, r.pattern, key).id(`moreup:dusk/${r.id}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 황혼 장비 레시피 등록 실패 (${r.id}): ${e}`)
        }
    })
    console.info(`[MoreUp] 황혼 장비 레시피 ${applied}/${MOREUP_DUSK_RECIPES.length}개 등록`)
})
