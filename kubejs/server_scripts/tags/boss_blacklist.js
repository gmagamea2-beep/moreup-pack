// priority: 0
// ============================================================
// More Up: 보스 포획/복제/분쇄 차단 (Industrial Foregoing)
// 경로: kubejs/server_scripts/tags/boss_blacklist.js
//
// IF 기본 블랙리스트는 거의 비어 있어서 다음 사기 루트가 열려 있다.
//   몹 포획 도구로 보스/드래곤 포획 → 몹 복제기로 무한 생성 → 몹 분쇄기로 전투 없이 드롭 수확
// 보스 태그(#forge:bosses, #c:bosses)와, 태그에 빠져 있는 보스를 세 블랙리스트에 모두 넣는다.
//   - 포획 도구 / 복제기: 대상에서 제외된다.
//   - 분쇄기: 즉사 처리 대신 일반 피해만 준다 (industrialforegoing/machine-agriculture-husbandry.toml 의
//     MobCrusherConfig.attackDamage, 현재 75).
// ============================================================

const MOREUP_IF_BLACKLIST_TAGS = [
    'industrialforegoing:mob_imprisonment_tool_blacklist',
    'industrialforegoing:mob_duplicator_blacklist',
    'industrialforegoing:mob_crusher_blacklist'
]

// 보스 공용 태그. Cataclysm, Twilight Forest, Aether, Meet Your Fight, Undergarden,
// Block Factory's Bosses, Lost Aether, Progressive Bosses, 바닐라 위더/엔더 드래곤 등이 들어 있다.
// #c:bosses 는 Bosses of Mass Destruction 이 채운다.
const MOREUP_BOSS_TAG_REFS = ['#forge:bosses', '#c:bosses']

// 공용 태그에 등록하지 않은(또는 1.20.1에서 인식되지 않는 경로에 등록한) 보스.
// 실제 레지스트리에 있는 ID만 추가하므로, 모드가 빠져도 태그 로딩이 깨지지 않는다.
const MOREUP_EXTRA_BOSS_PATTERNS = [
    /^iceandfire:(fire_dragon|ice_dragon|lightning_dragon|hydra|gorgon|cyclops|sea_serpent|dread_lich|dread_queen|black_frost_dragon)$/,
    /^mowziesmobs:(frostmaw|ferrous_wroughtnaut|umvuthi|sculptor)$/, // 모드가 태그를 1.21 경로(entity_type/)에 넣어서 1.20.1에선 무시됨
    /^aquamirae:(captain_cornelia|maze_mother)$/,
    /^twilight_forest_final_boss:castle_keeper$/,
    /^stalwart_dungeons:(nether_keeper|shelterer|shelterer_without_armor|awful_ghast)$/,
    /^bossominium:[a-z0-9_]+_boss$/
]

const $MoreUpForgeRegistries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')

function moreupCollectExtraBosses() {
    let found = []
    let iterator = $MoreUpForgeRegistries.ENTITY_TYPES.getKeys().iterator()
    while (iterator.hasNext()) {
        let id = String(iterator.next())
        for (let i = 0; i < MOREUP_EXTRA_BOSS_PATTERNS.length; i++) {
            if (MOREUP_EXTRA_BOSS_PATTERNS[i].test(id)) {
                found.push(id)
                break
            }
        }
    }
    return found
}

ServerEvents.tags('entity_type', event => {
    let extraBosses = moreupCollectExtraBosses()
    for (let i = 0; i < MOREUP_IF_BLACKLIST_TAGS.length; i++) {
        let tag = MOREUP_IF_BLACKLIST_TAGS[i]
        event.add(tag, MOREUP_BOSS_TAG_REFS)
        if (extraBosses.length > 0) event.add(tag, extraBosses)
    }
    console.info(`[MoreUp] IF 보스 블랙리스트: 공용 태그 ${MOREUP_BOSS_TAG_REFS.length}개 + 개별 보스 ${extraBosses.length}종 (${extraBosses.join(', ')})`)
})
