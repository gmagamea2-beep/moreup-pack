// priority: 0
// ============================================================
// More Up: 성장 시스템 태그 (More Up Core 1.2 숙련도, 2026-11-03)
// 경로: kubejs/server_scripts/tags/growth_tags.js
// 설계: MoreUp/docs/growth_system.md
//
// - moreup:tech_items  : 만들면 "기술" 숙련이 오르는 아이템 (기계·부품)
// - moreup:tech_blocks : 처음 설치하면 기술 숙련이 오르는 블록, 기술 숙련 25/50 의 빠른 채굴 대상
// - moreup:magic_items : 만들면 "마법" 숙련이 오르는 아이템
// - moreup:cooking_items 는 채우지 않는다: 비어 있으면 모드가 화로에서 꺼낸 음식·먹을 수 있는 조합 결과를 요리로 본다
//
// 재료(주괴·조각·가루·판·톱니·블록 등)와 건축 블록은 뺀다. 압축 ↔ 해체 왕복 조합으로 숙련을 쉽게 불릴 수 있기 때문
// 모드가 없으면 태그가 비어 있을 뿐이라 안전하다.
// ============================================================

const MOREUP_TECH_MODS = ['create', 'createaddition', 'create_connected', 'create_sa', 'create_enchantment_industry', 'create_mechanical_extruder',
    'mekanism', 'mekanismgenerators', 'mekanism_extras', 'mekmm', 'ae2', 'megacells', 'bigger_ae2', 'ae2things', 'ae2_mega_things', 'ae2insertexportcard',
    'ae2netanalyser', 'appflux', 'appmek', 'industrialforegoing', 'powah', 'thermal', 'pneumaticcraft', 'fluxnetworks', 'laserio', 'integrateddynamics',
    'pipez', 'immersive_aircraft', 'toms_storage']
const MOREUP_MAGIC_MODS = ['ebwizardry', 'forbidden_arcanus', 'enigmaticlegacy', 'enigmaticaddons', 'myth_wizardry']

// 재료·건축 블록·소모품으로 보는 이름 (ID 의 경로 부분)
const MOREUP_GROWTH_EXCLUDE = /(^|_)(ingot|nugget|dust|plate|gear|sheet|rod|wire|coin|raw|ore|crushed|dirty|clump|shard|crystal_shard|chunk|blend|slag|block|bricks?|slab|stairs|wall|pillar|tile|glass|pane|casing_block|lamp|carpet|planks|log|wood|leaves|sapling|bucket|seed|seeds|fluid|molten)(_|$)|^(white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)_|spawn_egg|creative/

function moreupGrowthCollect(mods, ids) {
    let out = []
    ids.forEach(id => {
        let s = String(id)
        let i = s.indexOf(':')
        if (i < 0) return
        if (mods.indexOf(s.substring(0, i)) < 0) return
        if (MOREUP_GROWTH_EXCLUDE.test(s.substring(i + 1))) return
        out.push(s)
    })
    return out
}

ServerEvents.tags('item', event => {
    try {
        let all = Item.getTypeList()
        let tech = moreupGrowthCollect(MOREUP_TECH_MODS, all)
        let magic = moreupGrowthCollect(MOREUP_MAGIC_MODS, all)
        tech.forEach(id => event.add('moreup:tech_items', id))
        magic.forEach(id => event.add('moreup:magic_items', id))
        console.info(`[MoreUp] 성장 태그: 기술 아이템 ${tech.length}, 마법 아이템 ${magic.length}`)
    } catch (e) {
        console.error(`[MoreUp] 성장 아이템 태그 실패: ${e}`)
    }
})

ServerEvents.tags('block', event => {
    try {
        // 블록 ID 목록은 아이템 목록에서 같은 ID 의 블록이 있는 것만 쓴다 (기계는 대부분 블록 아이템)
        let ids = moreupGrowthCollect(MOREUP_TECH_MODS, Item.getTypeList()).filter(id => !Block.getBlock(id).defaultBlockState().isAir())
        ids.forEach(id => event.add('moreup:tech_blocks', id))
        console.info(`[MoreUp] 성장 태그: 기계 블록 ${ids.length}`)
    } catch (e) {
        console.error(`[MoreUp] 성장 블록 태그 실패: ${e}`)
    }
})
