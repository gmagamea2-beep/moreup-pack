// priority: 0
// ============================================================
// More Up: TPA 시스템
// 경로: kubejs/server_scripts/systems/tpa.js
// (구 server_scripts/tpa.js 수정판)
//
// 명령어:
//   /tpa <플레이어>  - 텔레포트 요청 (플레이어 이름 자동완성 지원)
//   /tpaccept        - 받은 요청 수락
//   /tpdeny          - 받은 요청 거절
//
// 구버전에서 고친 점 (테스트 서버에서 각 접근자를 실제로 호출해 확인함):
//   - Arguments.STRING.get(...) 은 KubeJS 6에 없는 메서드라 /tpa 실행 시 오류가 났다
//     → Arguments.PLAYER.getResult(...) 로 교체 (온라인 플레이어만 선택, 자동완성)
//   - player.stringUUID 는 KubeJS 6에서 undefined 라서 모든 요청이 "자기 자신에게 보낼 수 없음"으로
//     막혔다 → KubeJS 접근자 stringUuid 로 교체
//   - teleportTo(ServerLevel, ...) 는 KubeJS 오버로드에 걸려 "Invalid dimension!" 오류가 난다
//     → teleportTo(차원 ID, x, y, z, yaw, pitch) 로 교체
//   - player.yRot / xRot 는 undefined → player.yaw / pitch 로 교체
//   - 요청자가 접속을 끊으면 받은 요청과 보낸 요청을 정리한다
// ============================================================

const MOREUP_TPA_TIMEOUT_TICKS = 20 * 30 // 30초

// key: 요청을 받은 플레이어 UUID, value: { fromUUID, fromName, time }
const moreupTpaRequests = {}
let moreupTpaTick = 0

function moreupFindOnlinePlayer(server, uuid) {
    let found = null
    server.playerList.players.forEach(p => {
        if (String(p.stringUuid) === uuid) found = p
    })
    return found
}

ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event

    event.register(
        Commands.literal('tpa')
            .then(
                Commands.argument('player', Arguments.PLAYER.create(event))
                    .executes(ctx => {
                        let sender = ctx.source.player
                        if (!sender) return 0

                        let target = Arguments.PLAYER.getResult(ctx, 'player')
                        let senderUUID = String(sender.stringUuid)
                        let targetUUID = String(target.stringUuid)

                        if (senderUUID === targetUUID) {
                            sender.tell('§c자기 자신에게 TPA를 보낼 수 없어요!')
                            return 0
                        }

                        moreupTpaRequests[targetUUID] = {
                            fromUUID: senderUUID,
                            fromName: String(sender.name.string),
                            time: moreupTpaTick
                        }

                        sender.tell(`§a${target.name.string}§f님께 텔레포트 요청을 보냈습니다. (30초 내 수락 필요)`)
                        target.tell(`§a${sender.name.string}§f님이 텔레포트를 요청했습니다. §e/tpaccept §f또는 §c/tpdeny`)
                        return 1
                    })
            )
    )

    event.register(
        Commands.literal('tpaccept')
            .executes(ctx => {
                let player = ctx.source.player
                if (!player) return 0

                let playerUUID = String(player.stringUuid)
                let request = moreupTpaRequests[playerUUID]
                if (!request) {
                    player.tell('§c받은 TPA 요청이 없습니다.')
                    return 0
                }
                delete moreupTpaRequests[playerUUID]

                if (moreupTpaTick - request.time > MOREUP_TPA_TIMEOUT_TICKS) {
                    player.tell('§cTPA 요청이 만료되었습니다. (30초 초과)')
                    return 0
                }

                let fromPlayer = moreupFindOnlinePlayer(ctx.source.server, request.fromUUID)
                if (!fromPlayer) {
                    player.tell(`§c${request.fromName}§c님이 서버에 없습니다.`)
                    return 0
                }

                // 수락 시점의 위치로 이동 (차원이 달라도 이동). 첫 인자는 차원 ID여야 한다.
                fromPlayer.teleportTo(
                    player.level.dimension,
                    player.x,
                    player.y,
                    player.z,
                    player.yaw,
                    player.pitch
                )

                player.tell(`§a${request.fromName}§f님의 TPA를 수락했습니다.`)
                fromPlayer.tell(`§a${player.name.string}§f님이 TPA를 수락했습니다. 텔레포트!`)
                return 1
            })
    )

    event.register(
        Commands.literal('tpdeny')
            .executes(ctx => {
                let player = ctx.source.player
                if (!player) return 0

                let playerUUID = String(player.stringUuid)
                let request = moreupTpaRequests[playerUUID]
                if (!request) {
                    player.tell('§c받은 TPA 요청이 없습니다.')
                    return 0
                }
                delete moreupTpaRequests[playerUUID]

                player.tell(`§c${request.fromName}§f님의 TPA를 거절했습니다.`)
                let fromPlayer = moreupFindOnlinePlayer(ctx.source.server, request.fromUUID)
                if (fromPlayer) {
                    fromPlayer.tell(`§c${player.name.string}§f님이 TPA를 거절했습니다.`)
                }
                return 1
            })
    )
})

// 틱 카운터 & 1분마다 만료된 요청 정리
// (tick 핸들러 예외는 다른 스크립트의 tick 핸들러까지 멈추게 하므로 경계에서 잡는다)
ServerEvents.tick(event => {
    moreupTpaTick++
    if (moreupTpaTick % (20 * 60) !== 0) return
    try {
        for (let uuid in moreupTpaRequests) {
            if (moreupTpaTick - moreupTpaRequests[uuid].time > MOREUP_TPA_TIMEOUT_TICKS) {
                delete moreupTpaRequests[uuid]
            }
        }
    } catch (e) {
        console.error(`[MoreUp] TPA 만료 요청 정리 실패: ${e}`)
    }
})

// 접속 종료 시 해당 플레이어가 받은/보낸 요청 정리 (메모리 누수 방지)
PlayerEvents.loggedOut(event => {
    try {
        let uuid = String(event.player.stringUuid)
        delete moreupTpaRequests[uuid]
        for (let key in moreupTpaRequests) {
            if (moreupTpaRequests[key].fromUUID === uuid) delete moreupTpaRequests[key]
        }
    } catch (e) {
        console.error(`[MoreUp] TPA 요청 정리 실패 (로그아웃): ${e}`)
    }
})
