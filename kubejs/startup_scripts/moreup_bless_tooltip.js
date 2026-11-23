// priority: 0
// ============================================================
// More Up: 구원의 반지를 끼면 저주 아이템 설명이 가려지지 않게
// 경로: kubejs/startup_scripts/moreup_bless_tooltip.js (클라이언트·서버 같은 파일, 서버에서는 아무것도 안 함)
//
// 2026-11-22 사용자 요청 "그 구원의 반지끼면 저주의 반지 아이템은 보이게 해줘".
// Enigmatic Legacy 2.30.1 EnigmaticEventHandler.onTooltip(ItemTooltipEvent, 우선순위 LOWEST) 은
// 저주받은 자(SuperpositionHandler.isTheCursedOne = 일곱 저주의 반지 착용)가 아니면
// 저주 아이템(api.items.ICursed)과 일곱 저주의 반지 설명을 무작위 글자로 바꾼다 (List.replaceAll → 줄 수는 그대로).
// 구원의 반지(enigmaticaddons:bless_ring)는 저주의 반지를 바꿔 만든 것이라 끼고 있어도 "저주받은 자"가 아니어서 가려졌다.
// 그래서 구원받은 자(Enigmatic Addons SuperAddonHandler.isTheBlessedOne)일 때:
//   LOW 에서 원래 설명 줄을 복사해 두고 → Enigmatic 다음(LOWEST)에 글자가 바뀐 줄만 원래 줄로 되돌린다.
// 같은 우선순위는 등록 순서대로 돌기 때문에, LOWEST 리스너는 Enigmatic 보다 뒤에 오도록 첫 해당 툴팁 때 등록한다
// (그 첫 프레임 한 번만 가려진 채 그려지고, 툴팁은 매 프레임 다시 만들어지므로 바로 보인다).
// 설명만 보이게 할 뿐, 아이템을 쓸 수 있는지(저주받은 자 전용 판정)는 바꾸지 않는다.
// 모드 클래스는 처음 쓸 때 불러온다 (startup 스크립트는 모드 생성 중에 돌아 정적 초기화 순서가 꼬일 수 있음).
// startup 스크립트라 바꾸면 게임을 재시작해야 한다. 로그는 console.info 만 쓴다(startup 의 console.error 는 로딩을 깨뜨림).
// ============================================================

const MOREUP_BLESS_TOOLTIP_CURSED_RING = 'enigmaticlegacy:cursed_ring'
const MOREUP_BLESS_TOOLTIP_MAX_LOGS = 5

let moreupBlessTooltipSnap = null        // { lines: [Component], texts: [string] } — LOW 에서 저장, LOWEST 에서 씀
let moreupBlessTooltipRestoreAdded = false
let moreupBlessTooltipHelpers = null     // { addon: SuperAddonHandler, cursed: ICursed }
let moreupBlessTooltipDisabled = false
let moreupBlessTooltipLogs = 0

function moreupBlessTooltipLog(where, e) {
    moreupBlessTooltipLogs++
    if (moreupBlessTooltipLogs <= MOREUP_BLESS_TOOLTIP_MAX_LOGS) {
        console.info(`[MoreUp] 구원의 반지 툴팁 ${where} 실패: ${e}`)
    }
}

function moreupBlessTooltipHelpersGet() {
    if (moreupBlessTooltipHelpers == null) {
        moreupBlessTooltipHelpers = {
            addon: Java.loadClass('auviotre.enigmatic.addon.handlers.SuperAddonHandler'),
            cursed: Java.loadClass('com.aizistral.enigmaticlegacy.api.items.ICursed')
        }
    }
    return moreupBlessTooltipHelpers
}

// Enigmatic 다음에 돈다: 글자가 바뀐 줄만 원래 줄로 되돌린다
function moreupBlessTooltipRestore(event) {
    let snap = moreupBlessTooltipSnap
    moreupBlessTooltipSnap = null
    if (snap == null) return
    try {
        let list = event.getToolTip()
        let n = Math.min(list.size(), snap.lines.length)
        for (let i = 0; i < n; i++) {
            if (String(list.get(i).getString()) !== snap.texts[i]) list.set(i, snap.lines[i])
        }
    } catch (e) {
        moreupBlessTooltipLog('되돌리기', e)
    }
}

// if 블록 안 최상위 const 는 KubeJS 6 startup 에서 "redeclaration of var" 로 스크립트 전체가 실패한다 → 함수로 감싼다
if (Platform.isClientEnvironment()) (function () {
    let $MoreUpBlessForge = Java.loadClass('net.minecraftforge.common.MinecraftForge')
    let $MoreUpBlessPriority = Java.loadClass('net.minecraftforge.eventbus.api.EventPriority')
    let $MoreUpBlessTooltipEvent = Java.loadClass('net.minecraftforge.event.entity.player.ItemTooltipEvent')

    $MoreUpBlessForge.EVENT_BUS.addListener($MoreUpBlessPriority.LOW, false, $MoreUpBlessTooltipEvent, event => {
        moreupBlessTooltipSnap = null
        if (moreupBlessTooltipDisabled) return
        try {
            let player = event.getEntity()
            if (player == null) return
            let stack = event.getItemStack()
            if (stack == null || stack.isEmpty()) return
            let h = moreupBlessTooltipHelpersGet()
            let isRing = String(stack.id) === MOREUP_BLESS_TOOLTIP_CURSED_RING
            if (!isRing && !(stack.getItem() instanceof h.cursed)) return
            if (!h.addon.isTheBlessedOne(player)) return

            let list = event.getToolTip()
            let lines = [], texts = []
            for (let i = 0; i < list.size(); i++) {
                let c = list.get(i)
                lines.push(c)
                texts.push(String(c.getString()))
            }
            moreupBlessTooltipSnap = { lines: lines, texts: texts }

            if (!moreupBlessTooltipRestoreAdded) {
                moreupBlessTooltipRestoreAdded = true
                $MoreUpBlessForge.EVENT_BUS.addListener($MoreUpBlessPriority.LOWEST, false, $MoreUpBlessTooltipEvent, e => moreupBlessTooltipRestore(e))
                console.info('[MoreUp] 구원의 반지 툴팁: 되돌리기 리스너 등록 (Enigmatic 다음)')
            }
        } catch (e) {
            moreupBlessTooltipLog('복사', e)
            // 클래스가 없는 등 계속 실패하면 끈다 (툴팁마다 예외를 던지지 않게)
            if (moreupBlessTooltipLogs >= MOREUP_BLESS_TOOLTIP_MAX_LOGS) moreupBlessTooltipDisabled = true
        }
    })
})()
