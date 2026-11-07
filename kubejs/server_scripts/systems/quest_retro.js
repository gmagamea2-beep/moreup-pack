// priority: 0
// ============================================================
// More Up: 퀘스트 아이템 과제 소급 (2026-11-07 사용자 요청, 1.12.0)
// 경로: kubejs/server_scripts/systems/quest_retro.js (데이터는 quest_retro_data.js — quests_src/gen_quest_retro.py 가 만든다)
//
// 이미 만들었거나 주운 적이 있는 아이템(바닐라 통계 crafted + picked_up)의 퀘스트 과제를 그 플레이어의 첫 접속 때 한 번 완료한다.
// 앞으로 얻는 아이템은 FTB Quests 진행 방식 flexible(data.snbt)로 선행 퀘스트와 상관없이 바로 인정된다.
// 완료 기록: server.persistentData "moreupQuestRetro.<UUID>" = 데이터 버전 (같은 버전은 다시 하지 않는다)
// ============================================================

const MOREUP_QUEST_RETRO_DELAY = 100   // 접속 후 5초: FTB 팀·퀘스트 데이터가 다 붙은 뒤

PlayerEvents.loggedIn(event => {
    try {
        let player = event.player
        let uuid = String(player.stringUuid)
        let ids = MOREUP_QUEST_RETRO[uuid]
        if (!ids || ids.length === 0) return
        let server = event.server
        let key = `moreupQuestRetro.${uuid}`
        if (String(server.persistentData.getString(key)) === MOREUP_QUEST_RETRO_VERSION) return
        let name = String(player.username)
        server.scheduleInTicks(MOREUP_QUEST_RETRO_DELAY, () => {
            try {
                let online = server.playerList.getPlayerByName(name)
                if (!online) return   // 그 사이 나갔으면 다음 접속 때 다시
                let ok = 0
                ids.forEach(id => {
                    if (server.runCommandSilent(`ftbquests change_progress ${name} complete ${id}`) > 0) ok++
                })
                server.persistentData.putString(key, MOREUP_QUEST_RETRO_VERSION)
                console.info(`[MoreUp] 퀘스트 소급 ${name}: 과제 ${ok}/${ids.length}개 완료 (버전 ${MOREUP_QUEST_RETRO_VERSION})`)
                if (ok > 0) online.tell(Text.gold(`[More Up] 이미 얻었던 아이템으로 퀘스트 과제 ${ok}개를 완료했습니다. 퀘스트 책에서 보상을 받으세요.`))
            } catch (e) {
                console.error(`[MoreUp] 퀘스트 소급 실패 (${name}): ${e}`)
            }
        })
    } catch (e) {
        console.error(`[MoreUp] 퀘스트 소급 예약 실패: ${e}`)
    }
})
