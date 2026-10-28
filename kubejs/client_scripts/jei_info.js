// priority: 0
// ============================================================
// More Up: JEI 아이템 설명 (보스 정수, 성주의 왕관, 모어 업)
// 경로: kubejs/client_scripts/jei_info.js
// 문구는 kubejs/assets/moreup/lang/*.json 의 jei.moreup.* 키
// ============================================================

JEIEvents.information(event => {
    ;['low', 'mid', 'high', 'legendary'].forEach(grade => {
        event.addItem(`moreup:boss_essence_${grade}`, [Text.translate(`jei.moreup.boss_essence_${grade}`)])
    })
    event.addItem('moreup:keepers_crown', [Text.translate('jei.moreup.keepers_crown')])
    event.addItem('moreup:more_up', [Text.translate('jei.moreup.more_up')])
    // 황혼 장비 (startup_scripts/moreup_dusk_gear.js)
    ;['dusk_shard', 'dusk_sigil', 'dusk_bow', 'dusk_cape'].forEach(id => {
        event.addItem(`moreup:${id}`, [Text.translate(`jei.moreup.${id}`)])
    })
})
