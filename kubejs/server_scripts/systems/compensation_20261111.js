// priority: 0
// ============================================================
// More Up: 1회 보상 지급 (2026-11-11 사용자 요청 "Gonkor1018 이 드래곤 잡고 못얻은 만큼 지금해줘")
// 경로: kubejs/server_scripts/systems/compensation_20261111.js
//
// 2026-11-11 18:57 Gonkor1018 이 엔더 드래곤을 잡았을 때 (1.13.3 전, 혼자 처치)
//  - Paraglider 하트 그릇: 바닐라 엔드 전투가 Stellarity 드래곤을 추적하지 않아 나오지 않음 → 1개
//  - dragonloot 비늘: 원래 3개 + 2번 x 80% (최대 5개). 1개만 출구 포탈 웅덩이에 남아 있었다(실서버 저장 파일)
//    → 남은 1개는 end_dragon_fix.js 가 기둥 위로 옮기고, 나머지 4개를 여기서 준다
// 받는 사람은 UUID 로 확인하고, 받으면 server.persistentData 에 기록해 다시 주지 않는다.
// 지급이 끝나면 이 파일을 지워도 된다.
// ============================================================

const MOREUP_COMP_KEY = 'moreupCompGonkorDragon20261111'
const MOREUP_COMP_UUID = '54988c7d-e89c-4578-9812-cd3fd24b848b'   // Gonkor1018 (서버 usercache.json)
const MOREUP_COMP_ITEMS = [['paraglider:heart_container', 1], ['dragonloot:dragon_scale', 4]]

PlayerEvents.loggedIn(event => {
    try {
        let player = event.player
        if (String(player.uuid) !== MOREUP_COMP_UUID) return
        let data = event.server.persistentData
        if (data.getBoolean(MOREUP_COMP_KEY)) return
        MOREUP_COMP_ITEMS.forEach(it => player.give(Item.of(it[0], it[1])))
        data.putBoolean(MOREUP_COMP_KEY, true)
        player.tell(Text.gold('[More Up] 드래곤 처치 때 못 받은 보상(하트 그릇 1, 드래곤 비늘 4)을 지급했습니다. 나머지 보상은 엔드 출구 포탈 기둥 위에 있어요.'))
        console.info(`[MoreUp] 1회 보상 지급: ${player.username} ${JSON.stringify(MOREUP_COMP_ITEMS)}`)
    } catch (e) {
        console.error(`[MoreUp] 1회 보상 지급 실패: ${e}`)
    }
})
