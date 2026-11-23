// More Up: 마법사의 심장(myth_wizardry 0.2.0) 인벤토리 위젯 위치 수정 (2026-11-13)
// 마법사가 되면 인벤토리 왼쪽 위(guiTop-28)에 68x28 판(마나 소모·자동 회복 체크박스 + 모드 버튼)이 생기는데,
// 그 자리가 다른 모드의 인벤토리 탭 줄과 같아서 탭을 덮고, 그 위 클릭도 위젯이 가로챈다.
// 모드에 위치 설정이 없어서, 그리기 직전(Render.Pre)마다 판과 버튼 좌표를 인벤토리 바로 아래로 옮긴다.
// - 모드는 Render.Post 에서 정적 필드 backgroundX/Y 와 위젯 자신의 좌표로 그리고, 클릭도 위젯 좌표로 판정한다 (jar 디스어셈블로 확인)
// - 레시피 책을 열어 인벤토리가 옆으로 밀려도 매 프레임 다시 계산하므로 따라간다
// - 클라이언트 전용. 실패하면 한 번만 로그를 남기고 원래 위치 그대로 둔다 (게임은 계속된다)
// Rhino 는 if 블록 안 const 를 "redeclaration" 오류로 거부해서(2026-11-13 클라이언트에서 확인) 함수 안에 둔다
if (Platform.isClientEnvironment()) (function () {
    let MOREUP_MAGE_GAP = 2            // 인벤토리 아래 끝과 판 사이 간격
    let moreupMage = null              // 리플렉션 캐시 (처음 쓸 때 준비)
    let moreupMageFailed = false

    let moreupMagePrepare = () => {
        let widgetCls = Java.loadClass('me.bread.myth_wizardry.gui.InventoryWidget').__javaObject__
        let absWidget = Java.loadClass('net.minecraft.client.gui.components.AbstractWidget').__javaObject__
        let field = (cls, name) => {
            let f = cls.getDeclaredField(name)
            f.setAccessible(true)
            return f
        }
        return {
            inventoryScreen: Java.loadClass('net.minecraft.client.gui.screens.inventory.InventoryScreen').__javaObject__,
            bgX: field(widgetCls, 'backgroundX'),
            bgY: field(widgetCls, 'backgroundY'),
            cb1: field(widgetCls, 'checkboxManaFirst'),
            cb2: field(widgetCls, 'checkboxAutoSecond'),
            btn: field(widgetCls, 'modeButton'),
            // AbstractWidget 의 x·y (SRG, 1.20.1 srg jar 로 확인). setX/setY 는 값만 넣으므로 필드에 바로 쓴다
            x: field(absWidget, 'f_93620_'),
            y: field(absWidget, 'f_93621_')
        }
    }

    let moreupMageMove = (m, widget, x, y) => {
        if (widget == null) return
        if (m.x.getInt(widget) != x) m.x.setInt(widget, x)
        if (m.y.getInt(widget) != y) m.y.setInt(widget, y)
    }

    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$Render$Pre', event => {
        if (moreupMageFailed) return
        try {
            if (moreupMage == null) {
                moreupMage = moreupMagePrepare()
                console.info('[MoreUp] 마법사 인벤토리 위젯 위치 수정 준비 완료')
            }
            let m = moreupMage
            let screen = event.getScreen()
            if (!m.inventoryScreen.isInstance(screen)) return
            // 위젯이 아직 없으면(마법사가 아님·기능 꺼짐) 할 일이 없다
            if (m.cb1.get(null) == null && m.btn.get(null) == null) return
            let left = screen.getGuiLeft()
            let bgY = screen.getGuiTop() + screen.getYSize() + MOREUP_MAGE_GAP
            // 모드 원래 배치(판 기준 상대 위치)를 그대로 유지: 체크박스 (4,4)·(26,4), 모드 버튼 (48,6)
            if (m.bgX.getInt(null) != left) m.bgX.setInt(null, left)
            if (m.bgY.getInt(null) != bgY) m.bgY.setInt(null, bgY)
            moreupMageMove(m, m.cb1.get(null), left + 4, bgY + 4)
            moreupMageMove(m, m.cb2.get(null), left + 26, bgY + 4)
            moreupMageMove(m, m.btn.get(null), left + 48, bgY + 6)
        } catch (e) {
            moreupMageFailed = true
            console.error(`[MoreUp] 마법사 인벤토리 위젯 위치 수정 실패 (원래 위치로 둔다): ${e}`)
        }
    })
})()
