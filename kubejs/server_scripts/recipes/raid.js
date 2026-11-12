// priority: 0
// ============================================================
// More Up: 파티 레이드 조합법 (More Up Core 1.7.0 / 팩 1.14, 2026-11-12)
// 경로: kubejs/server_scripts/recipes/raid.js
// 설계: MoreUp/docs/raid_design.md (아이템·블록은 모드가 등록, 조합법은 팩)
//
// 레이드 인장 (무형 조합)
//   하급 = 하급 정수 4 + 금 블록         중급 = 중급 정수 3 + 다이아몬드 블록
//   상급 = 상급 정수 2 + 네더라이트 주괴  전설 = 전설 정수 1 + 성룡의 비늘 4
// 레이드 제단 = 깎은 윤나는 흑암 5 + 금 주괴 2 + 하급 정수 + 자석석
// 결속 각인석 = 토벌 결정 3 + 중급 정수 1
// 반지 2종(증표 24 + 결정 2)·토벌대 깃발(증표 40 + 결정 4)은 제작대 9칸에 들어가지 않는 수량이라
// 퀘스트 챕터 「토벌대」의 반복 교환(아이템 제출)으로 준다 (quests_src/add_raid_2026-11-12.py)
//
// 재료 ID 는 레지스트리 덤프(MoreUp/quests_src/registry/reg_items.txt)에서 확인했다.
// 결과(모드 아이템)가 없으면 조용히 건너뛰고(모드가 1.7.0 이전), 재료가 없으면 오류를 남긴다 (constellation.js 와 같은 방식).
// ============================================================

const MOREUP_RAID_RECIPES = [
    { id: 'raid_key_low', type: 'shapeless', inputs: ['4x moreup:boss_essence_low', 'minecraft:gold_block'] },
    { id: 'raid_key_mid', type: 'shapeless', inputs: ['3x moreup:boss_essence_mid', 'minecraft:diamond_block'] },
    { id: 'raid_key_high', type: 'shapeless', inputs: ['2x moreup:boss_essence_high', 'minecraft:netherite_ingot'] },
    { id: 'raid_key_legendary', type: 'shapeless', inputs: ['moreup:boss_essence_legendary', '4x moreup:star_scale'] },
    { id: 'raid_altar', type: 'shaped', pattern: ['GEG', 'BLB', 'BBB'], key: {
        G: 'minecraft:gold_ingot', E: 'moreup:boss_essence_low', L: 'minecraft:lodestone', B: 'minecraft:chiseled_polished_blackstone' } },
    { id: 'engraving_bond', type: 'shapeless', inputs: ['3x moreup:raid_crystal', 'moreup:boss_essence_mid'] }
]

/** '3x a:b' → ['a:b', 'a:b', 'a:b'] (무형 조합은 칸마다 하나씩 적어야 그 수만큼 쓴다) */
function moreupRaidExpand(inputs) {
    let out = []
    inputs.forEach(s => {
        let m = /^(\d+)x (.+)$/.exec(s)
        let n = m ? parseInt(m[1]) : 1
        let id = m ? m[2] : s
        for (let i = 0; i < n; i++) out.push(id)
    })
    return out
}

ServerEvents.recipes(event => {
    let applied = 0
    MOREUP_RAID_RECIPES.forEach(r => {
        let result = `moreup:${r.id}`
        try {
            if (Item.of(result).isEmpty()) return   // 모드가 1.7.0 이전
            let ids = r.type === 'shapeless' ? moreupRaidExpand(r.inputs) : Object.keys(r.key).map(k => r.key[k])
            let missing = ids.filter(id => Item.of(id).isEmpty())
            if (missing.length > 0) {
                console.error(`[MoreUp] 레이드 레시피 ${r.id} 재료 없음: ${missing.join(', ')}`)
                return
            }
            if (r.type === 'shapeless') event.shapeless(result, ids).id(`moreup:raid/${r.id}`)
            else event.shaped(result, r.pattern, r.key).id(`moreup:raid/${r.id}`)
            applied++
        } catch (e) {
            console.error(`[MoreUp] 레이드 레시피 등록 실패 (${r.id}): ${e}`)
        }
    })
    console.info(`[MoreUp] 레이드 레시피 ${applied}/${MOREUP_RAID_RECIPES.length}개 등록`)
})
