// priority: 0
// ============================================================
// More Up: 구조물 상자에서 정수가 나온다 (2026-10-27 사용자 요청: 정수 획득처 대폭 증가)
// 경로: kubejs/server_scripts/loot/essence_chests.js
//
// 바닐라 구조물 상자 루트 테이블에 정수 풀을 하나 더한다 (기존 전리품은 그대로, Lootr 로 플레이어마다 따로 나온다).
// 풀은 한 번 굴리고, 아래 가중치 중 하나가 나온다 (빈칸 = 이번 상자에는 정수 없음).
//   일반: 잠든 정수 2~4개 35 / 하급 1개 15 / 없음 50
//   위험: 잠든 3~6개 30 / 하급 1~2개 30 / 중급 1개 8 / 없음 32
//   정예: 하급 2~3개 30 / 중급 1~2개 25 / 상급 1개 5 / 없음 40
// 이미 만들어진 상자(열어 본 상자)는 바뀌지 않는다. 새로 여는 상자부터 적용된다.
// ============================================================

const MOREUP_ESSENCE_CHEST_TIERS = {
    common: {
        tables: ['simple_dungeon', 'abandoned_mineshaft', 'desert_pyramid', 'jungle_temple', 'igloo_chest', 'ruined_portal',
            'shipwreck_treasure', 'buried_treasure', 'pillager_outpost', 'underwater_ruin_big', 'village/village_weaponsmith'],
        entries: [['moreup:dormant_essence', 35, [2, 4]], ['moreup:boss_essence_low', 15, 1]],
        empty: 50
    },
    danger: {
        tables: ['stronghold_corridor', 'stronghold_crossing', 'stronghold_library', 'woodland_mansion', 'nether_bridge',
            'bastion_other', 'bastion_bridge', 'bastion_hoglin_stable', 'ancient_city'],
        entries: [['moreup:dormant_essence', 30, [3, 6]], ['moreup:boss_essence_low', 30, [1, 2]], ['moreup:boss_essence_mid', 8, 1]],
        empty: 32
    },
    elite: {
        tables: ['end_city_treasure', 'bastion_treasure', 'ancient_city_ice_box'],
        entries: [['moreup:boss_essence_low', 30, [2, 3]], ['moreup:boss_essence_mid', 25, [1, 2]], ['moreup:boss_essence_high', 5, 1]],
        empty: 40
    }
}

ServerEvents.chestLootTables(event => {
    let applied = 0
    for (let tierKey in MOREUP_ESSENCE_CHEST_TIERS) {
        let tier = MOREUP_ESSENCE_CHEST_TIERS[tierKey]
        tier.tables.forEach(name => {
            try {
                event.modify(`minecraft:${name}`, table => {
                    table.addPool(pool => {
                        pool.setUniformRolls(1, 1)
                        tier.entries.forEach(e => {
                            let count = Array.isArray(e[2]) ? { min: e[2][0], max: e[2][1] } : e[2]
                            pool.addItem(Item.of(e[0]), e[1], count)
                        })
                        pool.addEmpty(tier.empty)
                    })
                })
                applied++
            } catch (err) {
                console.error(`[MoreUp] 상자 정수 추가 실패 (${name}): ${err}`)
            }
        })
    }
    console.info(`[MoreUp] 구조물 상자 정수 풀 ${applied}개 테이블에 추가`)
})
