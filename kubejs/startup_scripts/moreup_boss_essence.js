// priority: 10
// ============================================================
// More Up: 보스 정수 아이템 4종
// 경로: kubejs/startup_scripts/moreup_boss_essence.js
//
// 보스 티어별 드롭(server_scripts/systems/boss_rewards.js)으로 얻고,
// 테크 핵심 기계·등급 설치기 레시피의 열쇠로 쓴다(server_scripts/recipes/tech_gating.js).
//   하급(low)       : 10~8티어 보스
//   중급(mid)       : 7~6티어 보스
//   상급(high)      : 5~4티어 보스
//   전설(legendary) : 3~1티어 보스
// 이름·설명은 kubejs/assets/moreup/lang/*.json
// 아이템 ID를 바꾸면 이미 얻은 정수가 월드에서 사라지므로 바꾸지 않는다.
// ============================================================

StartupEvents.registry('item', event => {
    const essences = [
        { id: 'moreup:boss_essence_low', color: 0x8EE07A, rarity: 'uncommon' },
        { id: 'moreup:boss_essence_mid', color: 0x5AB4FF, rarity: 'rare' },
        { id: 'moreup:boss_essence_high', color: 0xC77DFF, rarity: 'rare' },
        { id: 'moreup:boss_essence_legendary', color: 0xFFC54D, rarity: 'epic' }
    ]
    essences.forEach(e => {
        event.create(e.id)
            .texture(e.id.replace('moreup:', 'moreup:item/'))   // 원작 텍스처 (MoreUp/textures_src/draw_endgame.ps1)
            .rarity(e.rarity)
            .glow(true)
            .fireResistant(true) // 이그니스·네더 보스 전장의 용암에 떨어져도 타지 않게
            .tooltip(Text.translate(`tooltip.${e.id.replace(':', '.')}`).gray())
    })

    // 정수 자동화 재료 (2026-10-26): Create 기계 손이 보스 트로피를 대어 깨운다 (server_scripts/recipes/essence_exchange.js)
    event.create('moreup:dormant_essence')
        .texture('moreup:item/dormant_essence')
        .rarity('common')
        .tooltip(Text.translate('tooltip.moreup.dormant_essence').gray())
    // 순서 조립 중간 단계 (Create sequenced assembly 의 transitional item)
    event.create('moreup:incomplete_mid_essence').texture('moreup:item/incomplete_mid_essence').maxStackSize(1)
    event.create('moreup:incomplete_high_essence').texture('moreup:item/incomplete_high_essence').maxStackSize(1)
})
