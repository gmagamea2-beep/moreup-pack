// priority: 0
// ============================================================
// More Up: 팩 클리어 연출
// 경로: kubejs/server_scripts/systems/more_up_clear.js
//
// "모어 업"을 처음 얻으면 발전과제 moreup:more_up 이 달성되고(kubejs/data/moreup/advancements/more_up.json),
// 그때 서버 전체에 클리어를 알린다: 타이틀, 효과음, 폭죽, 채팅 공지.
// 클리어 순서는 서버 영구 데이터(world/kubejs_persistent_data.nbt)에 남는다.
// ============================================================

const MOREUP_CLEAR_COUNT_KEY = 'moreupClearCount'
const MOREUP_CLEAR_NAMES_KEY = 'moreupClearNames'

// 클리어 순번을 하나 올리고 기록한 뒤 그 순번을 돌려준다
function moreupRecordClear(server, playerName) {
    let data = server.persistentData
    let order = data.getInt(MOREUP_CLEAR_COUNT_KEY) + 1
    data.putInt(MOREUP_CLEAR_COUNT_KEY, order)
    let names = String(data.getString(MOREUP_CLEAR_NAMES_KEY))
    data.putString(MOREUP_CLEAR_NAMES_KEY, names === '' ? playerName : `${names},${playerName}`)
    return order
}

function moreupCelebrateClear(server, player) {
    let name = String(player.name.string)
    let order = moreupRecordClear(server, name)

    server.runCommandSilent('title @a times 10 100 30')
    server.runCommandSilent('title @a title {"text":"MORE UP","color":"gold","bold":true}')
    server.runCommandSilent(`title @a subtitle {"text":"${name} 님이 모어 업을 완성했습니다! (${order}번째 클리어)","color":"yellow"}`)
    server.runCommandSilent('playsound minecraft:ui.toast.challenge_complete master @a ~ ~ ~ 1 1 1')
    server.tell(`§6§l[MORE UP] §e${name}§f 님이 모든 세계를 모아 §6모어 업§f을 완성했습니다! §7(${order}번째 클리어)`)

    // 플레이어 주변에 폭죽 3발
    let offsets = [[0, 0], [2, 1], [-2, -1]]
    offsets.forEach(o => {
        server.runCommandSilent(`execute at ${name} run summon minecraft:firework_rocket ~${o[0]} ~1 ~${o[1]} {LifeTime:30,FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Flight:2b,Explosions:[{Type:1,Flicker:1b,Trail:1b,Colors:[I;16766720,16729344,11141290],FadeColors:[I;16777215]}]}}}}`)
    })
    console.info(`[MoreUp] 팩 클리어: ${name} (${order}번째)`)
}

PlayerEvents.advancement('moreup:more_up', event => {
    try {
        let server = Utils.server
        if (server) moreupCelebrateClear(server, event.player)
    } catch (e) {
        console.error(`[MoreUp] 클리어 연출 실패: ${e}`)
    }
})
