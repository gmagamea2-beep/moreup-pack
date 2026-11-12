// ============================================================
// More Up: Jade 정보 창 항상 켜기 (2026-11-11 사용자 요청 "jade 항상 켜지게")
// 경로: kubejs/client_scripts/jade_always_on.js
//
// Jade 는 표시 모드 TOGGLE 이라 [Jade 표시] 키(기본 숫자패드 1)를 한 번 누르면 꺼지고, 그 상태가 config/jade/jade.json 에 저장돼
// 다음 접속에도 꺼진 채로 남는다. 서버·월드에 들어갈 때마다 다시 켠다 (접속 중 키로 잠깐 끄는 것은 그대로 된다).
// 팩 기본 설정(config/jade/jade.json)도 displayTooltip = true.
// ============================================================

const $MoreUpJadeConfig = Java.loadClass('snownee.jade.api.config.IWailaConfig')

ClientEvents.loggedIn(event => {
    try {
        let general = $MoreUpJadeConfig.get().getGeneral()
        if (!general.shouldDisplayTooltip()) {
            general.setDisplayTooltip(true)
            console.info('[MoreUp] Jade 정보 창을 다시 켰습니다')
        }
    } catch (e) {
        console.error(`[MoreUp] Jade 켜기 실패: ${e}`)
    }
})
