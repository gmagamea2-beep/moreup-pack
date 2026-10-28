// priority: 0
// ============================================================
// More Up: 너무 싸거나 악용되는 레시피 조정 + 만들 방법이 없던 아이템 추가
// 경로: kubejs/server_scripts/recipes/balance_fixes.js
// 근거: MoreUp/docs/recipe_audit.md (2026-10-22 레시피 20,923개 덤프 분석)
//
// - 강한 생존·전투 아이템은 보스 정수로 묶어 보스 진행과 맞춘다 (하급: 티어 10~8 / 중급: 7~6)
// - 원래 레시피는 ID로 지우고 같은 결과물의 새 레시피를 moreup:balance/* ID로 넣는다
// - 재료가 레지스트리에 없으면 그 레시피는 등록하지 않고 오류를 남긴다 (원래 레시피도 지우지 않음)
// ============================================================

const MOREUP_ESSENCE_LOW = 'moreup:boss_essence_low'
const MOREUP_ESSENCE_MID = 'moreup:boss_essence_mid'

// 바꾸기: remove 의 원래 레시피를 지우고 같은 결과물을 새 패턴으로 등록
const MOREUP_BALANCE_REPLACE = [
    // 불사의 토템: 에메랄드 2 + 금 4 + 엔드 수정(Stellarity가 가스트 눈물을 뺌)이라 보스전 목숨을 무한히 찍어 낼 수 있었다
    { id: 'totem_of_undying', remove: 'craftabletotemofundying:totem_of_undying', result: 'minecraft:totem_of_undying',
      pattern: ['EGE', 'GCG', 'EME'], key: { E: 'minecraft:emerald_block', G: 'minecraft:gold_block', C: 'minecraft:end_crystal', M: MOREUP_ESSENCE_MID } },
    // 흡혈 장갑: 가죽 + 레드스톤 블록. 피격 무적 시간이 없는 팩(ReNDI)이라 흡혈이 매우 강하다
    { id: 'vampiric_glove', remove: 'artifactscrafting:vampiric_glove', result: 'artifacts:vampiric_glove',
      pattern: ['aba', 'aea', ' a '], key: { a: 'minecraft:leather', b: 'minecraft:redstone_block', e: MOREUP_ESSENCE_MID } },
    // 수정 심장: 최대 체력 크게 증가. 다이아몬드 자리에 중급 정수
    { id: 'crystal_heart', remove: 'artifactscrafting:crystal_heart_recipe', result: 'artifacts:crystal_heart',
      pattern: ['aba', 'cde', 'aba'], key: { a: 'minecraft:redstone', b: 'minecraft:emerald', c: 'minecraft:golden_apple', d: MOREUP_ESSENCE_MID, e: 'minecraft:golden_carrot' } },
    // 무한 음식 2종: 금 블록 + 고기로 Tough As Nails·Spice of Life 식량 시스템을 무시하게 된다
    { id: 'everlasting_beef', remove: 'artifactscrafting:everlasting_beef_recipe', result: 'artifacts:everlasting_beef',
      pattern: ['aaa', 'aba', 'aea'], key: { a: 'minecraft:gold_block', b: 'minecraft:beef', e: MOREUP_ESSENCE_MID } },
    { id: 'eternal_steak', remove: 'artifactscrafting:eternal_steak_recipe', result: 'artifacts:eternal_steak',
      pattern: ['aaa', 'aba', 'aea'], key: { a: 'minecraft:gold_block', b: 'minecraft:cooked_beef', e: MOREUP_ESSENCE_MID } },
    // 힘의 장갑(공격력), 야수의 발톱(공격 속도): 하급 정수
    { id: 'power_glove', remove: 'artifactscrafting:power_glove_recipe', result: 'artifacts:power_glove',
      pattern: ['aba', 'bcb', ' d '], key: { a: 'minecraft:gold_ingot', b: 'minecraft:gold_block', c: MOREUP_ESSENCE_LOW, d: 'minecraft:leather' } },
    { id: 'feral_claws', remove: 'artifactscrafting:feral_claws_recipe', result: 'artifacts:feral_claws',
      pattern: [' a ', 'bcb', ' b '], key: { a: MOREUP_ESSENCE_LOW, b: 'minecraft:emerald', c: 'minecraft:diamond_sword' } }
]

// 지우기만: 언데드 생성 알을 던전 스포너에 쓰면 위더 스켈레톤·가스트 스포너가 되어 네더의 별을 무한히 얻는다
const MOREUP_BALANCE_REMOVE = [
    'l2complements:eggs/undead/drowned_spawn_egg',
    'l2complements:eggs/undead/ghast_spawn_egg',
    'l2complements:eggs/undead/husk_spawn_egg',
    'l2complements:eggs/undead/phantom_spawn_egg',
    'l2complements:eggs/undead/skeleton_spawn_egg',
    'l2complements:eggs/undead/stray_spawn_egg',
    'l2complements:eggs/undead/wither_skeleton_spawn_egg',
    'l2complements:eggs/undead/zombie_spawn_egg',
    'l2complements:eggs/undead/zombified_piglin_spawn_egg'
]

// 추가: 바닐라에서 만들 방법이 없던 아이템
const MOREUP_BALANCE_ADD = [
    { id: 'iron_horse_armor', result: 'minecraft:iron_horse_armor', pattern: ['  X', 'XWX', 'XXX'], key: { X: 'minecraft:iron_ingot', W: '#minecraft:wool' } },
    { id: 'golden_horse_armor', result: 'minecraft:golden_horse_armor', pattern: ['  X', 'XWX', 'XXX'], key: { X: 'minecraft:gold_ingot', W: '#minecraft:wool' } },
    { id: 'diamond_horse_armor', result: 'minecraft:diamond_horse_armor', pattern: ['  X', 'XWX', 'XXX'], key: { X: 'minecraft:diamond', W: '#minecraft:wool' } },
    { id: 'bell', result: 'minecraft:bell', pattern: [' S ', 'GGG', 'GNG'], key: { S: 'minecraft:stick', G: 'minecraft:gold_ingot', N: 'minecraft:gold_nugget' } },
    { id: 'budding_amethyst', result: 'minecraft:budding_amethyst', pattern: ['AAA', 'ADA', 'AAA'], key: { A: 'minecraft:amethyst_block', D: 'minecraft:diamond_block' } }
]

function moreupBalanceMissing(r) {
    let missing = []
    for (let k in r.key) {
        let v = r.key[k]
        if (v.startsWith('#')) continue    // 태그는 비어 있어도 레시피 자체는 유효
        if (Item.of(v).isEmpty()) missing.push(v)
    }
    if (Item.of(r.result).isEmpty()) missing.push(r.result)
    return missing
}

ServerEvents.recipes(event => {
    let replaced = 0, removed = 0, added = 0
    MOREUP_BALANCE_REPLACE.forEach(r => {
        try {
            let missing = moreupBalanceMissing(r)
            if (missing.length > 0) { console.error(`[MoreUp] 밸런스 레시피 ${r.id} 재료 없음 (원래 레시피 유지): ${missing.join(', ')}`); return }
            event.remove({ id: r.remove })
            event.shaped(r.result, r.pattern, r.key).id(`moreup:balance/${r.id}`)
            replaced++
        } catch (e) { console.error(`[MoreUp] 밸런스 레시피 교체 실패 (${r.id}): ${e}`) }
    })
    MOREUP_BALANCE_REMOVE.forEach(id => {
        try { event.remove({ id: id }); removed++ } catch (e) { console.error(`[MoreUp] 레시피 제거 실패 (${id}): ${e}`) }
    })
    MOREUP_BALANCE_ADD.forEach(r => {
        try {
            let missing = moreupBalanceMissing(r)
            if (missing.length > 0) { console.error(`[MoreUp] 추가 레시피 ${r.id} 재료 없음: ${missing.join(', ')}`); return }
            event.shaped(r.result, r.pattern, r.key).id(`moreup:balance/${r.id}`)
            added++
        } catch (e) { console.error(`[MoreUp] 레시피 추가 실패 (${r.id}): ${e}`) }
    })
    console.info(`[MoreUp] 밸런스 레시피: 교체 ${replaced}/${MOREUP_BALANCE_REPLACE.length}, 제거 ${removed}, 추가 ${added}/${MOREUP_BALANCE_ADD.length}`)
})
