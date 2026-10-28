// priority: 10
// ============================================================
// More Up: 최종 목표 아이템
// 경로: kubejs/startup_scripts/moreup_endgame_items.js
// 설계: MoreUp/docs/endgame.md
//
//   각 분야의 최종 아이템 → 세계의 파편 9종 → 세계 → (세계 + 좋은 아이템 8개) → 모어 업
//   모어 업을 얻으면 팩 클리어 (발전과제 moreup:more_up, 연출은 server_scripts/systems/more_up_clear.js)
//   성주의 왕관은 최종 보스 Castle Keeper 처치 보상이며 모어 업 재료다.
// 레시피: server_scripts/recipes/endgame.js / 이름: kubejs/assets/moreup/lang/*.json
// 아이템 ID를 바꾸면 이미 만든 아이템이 월드에서 사라지므로 바꾸지 않는다.
// ============================================================

// [ID 접미사, 분야 색] — 색은 텍스처 생성기(draw_endgame.ps1)와 같다
const MOREUP_FRAGMENTS = [
    ['tech', 0x4FC3F7],      // 기술
    ['magic', 0x9C4DCC],     // 마법
    ['war', 0xE53935],       // 전쟁
    ['dragon', 0xFF8F00],    // 용
    ['sky', 0xFFF176],       // 하늘
    ['twilight', 0x43A047],  // 황혼
    ['depths', 0x3949AB],    // 심연
    ['harvest', 0xC0CA33],   // 풍요
    ['end', 0xF06292]        // 종말
]

StartupEvents.registry('item', event => {
    event.create('moreup:keepers_crown')
        .texture('moreup:item/keepers_crown')   // 황혼의 왕관 (MoreUp/textures_src/draw_endgame.ps1)
        .rarity('epic')
        .glow(true)
        .fireResistant(true)
        .tooltip(Text.translate('tooltip.moreup.keepers_crown').gray())

    MOREUP_FRAGMENTS.forEach(f => {
        event.create(`moreup:fragment_${f[0]}`)
            .texture(`moreup:item/fragment_${f[0]}`)   // 깨진 인장 조각 (MoreUp/textures_src/draw_endgame.ps1)
            .rarity('rare')
            .glow(true)
            .fireResistant(true)
            .tooltip(Text.translate(`tooltip.moreup.fragment_${f[0]}`).gray())
    })

    event.create('moreup:world')
        .texture('moreup:item/world')   // 혼천의 고리를 두른 행성 (MoreUp/textures_src/draw_endgame.ps1)
        .rarity('epic')
        .glow(true)
        .fireResistant(true)
        .tooltip(Text.translate('tooltip.moreup.world').gray())

    event.create('moreup:more_up')
        .texture('moreup:item/more_up')   // 왕관을 쓴 인장 속 세계 (MoreUp/textures_src/draw_endgame.ps1)
        .rarity('epic')
        .glow(true)
        .fireResistant(true)
        .unstackable()
        .tooltip(Text.translate('tooltip.moreup.more_up').gold())
})
