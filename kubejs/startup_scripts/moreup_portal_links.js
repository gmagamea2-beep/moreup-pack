// More Up: 지옥문 고정 연결 — 차원 이동 이벤트 연결부 (2026-11-10)
// 실제 판정·이동은 server_scripts/systems/portal_links.js 가 global.moreupPortalTravel 로 넣는다.
// (startup 스크립트는 다시 읽으려면 게임을 껐다 켜야 하므로, 바뀔 수 있는 처리는 서버 스크립트에 둔다)
ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityTravelToDimensionEvent', event => {
    try {
        let fn = global.moreupPortalTravel
        if (fn) fn(event)
    } catch (e) {
        console.error('[MoreUp] 지옥문 고정 연결 처리 실패: ' + e)
    }
})
