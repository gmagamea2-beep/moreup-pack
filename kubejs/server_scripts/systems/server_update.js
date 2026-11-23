// More Up: 게임 안에서 서버 GitHub 동기화 요청 (2026-11-21 사용자 요청 "2시간마다 자동 업뎃 + 유저가 직접 업뎃도 되게")
//  - /서버업뎃 (관리자, 권한 3) → 서버 로그에 "MOREUP_UPDATE_REQUEST <번호> <이름>" 한 줄을 남긴다
//  - 서버 PC 작업 스케줄러(server_sync/sync.ps1, 5분마다)가 이 줄을 보고 GitHub 비공개 저장소와 동기화한다
//  - 받아온 설정·스크립트는 서버 재시작(또는 /reload) 뒤 적용된다. 이 명령은 서버를 끄지 않는다
ServerEvents.commandRegistry(event => {
    const { commands: Commands } = event
    event.register(
        Commands.literal('서버업뎃')
            .requires(src => src.hasPermission(3))
            .executes(ctx => {
                let src = ctx.source
                let name = 'console'
                try {
                    if (src.player != null) name = String(src.player.username)
                } catch (e) {
                    /* 이름을 못 읽어도 요청은 남긴다 */
                }
                console.info(`MOREUP_UPDATE_REQUEST ${Date.now()} ${name.replace(/\s/g, '_')}`)
                src.sendSuccess(Text.translate('message.moreup.server_update.requested'), true)
                return 1
            })
    )
})
