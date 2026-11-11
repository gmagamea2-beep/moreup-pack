// priority: 0
// ============================================================
// More Up: 엔더 드래곤 처치 보상 누락 수정 (2026-11-11 사용자 보고 "드래곤비늘 dragonloot 하트그릇 이렇게 안나옴")
// 경로: kubejs/server_scripts/loot/ender_dragon_drops_fix.js
//
// 1) 처치 보상이 공허로 떨어짐
//    dragonloot 비늘, Core 정수·성룡의 비늘, 하트(BHC), Forbidden Arcanus·Quark 비늘, IE 셰이더 가방 등은
//    드래곤이 "치명타를 맞은 자리"(사망 이벤트 시점)에 떨어지고, 경험치(Progressive Bosses 10000)는 그 뒤 죽는 연출(약 10초) 동안
//    드래곤 위치에서 떨어진다. 섬 밖 허공을 날 때 잡히면 이것들이 전부 공허로 떨어진다
//    (시험 서버: 포탈에 앉아 있을 때 잡으면 모두 남고, z=150 허공에서 잡으면 사라짐).
//    → 죽은 뒤 연출이 끝날 때까지 치명타 자리와 드래곤 주변의 아이템·경험치를 그 자리에 멈춰 두고,
//      연출과 Stellarity 출구 포탈 생성이 끝나면 엔드 포탈 기둥 위로 옮긴다 (공중에 떠 있게).
// 2) Paraglider 하트 그릇이 안 나옴
//    Paraglider 는 바닐라 엔드 전투(EndDragonFight#setDragonKilled)가 자기가 추적하는 드래곤이 죽었다고 처리할 때만
//    포탈 위에 하트 그릇을 떨군다. 이 팩의 드래곤은 Stellarity 가 소환하고, 실서버의 바닐라 전투 기록은 이미 "처치됨"이라
//    드래곤을 추적하지 않는다 → 하트 그릇이 안 나온다. 옮기는 시점에 포탈 위에 하트 그릇이 없으면 대신 떨군다 (두 개 나오지 않게).
//    Paraglider 설정: enderDragonDropsVessel = true, heartContainers = true → 하트 그릇
// 3) Stellarity 보상(휘장·타마리스·문장)은 Stellarity 표식 자리에서 떠 있는 채로 나오는데, 드래곤이 높이 떠서 죽으면
//    포탈 위 30칸 넘게 높은 곳에 떠 있다 (시험: y=110, 기둥 위 y=76) → 30초 뒤 기둥 위 공중의 아이템을 기둥 위로 내린다.
// ============================================================

const MOREUP_EDD_RADIUS = 16                 // 치명타 자리·드래곤에서 이 거리 안의 아이템·경험치를 붙잡는다
const MOREUP_EDD_FREEZE_EVERY = 5            // 연출 동안 이 틱마다 붙잡는다 (공허까지 떨어지기 전에)
const MOREUP_EDD_DELIVER_AT = 300            // 죽고 15초 뒤 포탈 위로 옮긴다 (바닐라·Stellarity 죽음 연출 약 10초 + 포탈 생성)
const MOREUP_EDD_SWEEP_AT = 600             // 30초 뒤 포탈 기둥 위 공중에 뜬 보상(Stellarity 보상 등)을 기둥 위로 내린다
const MOREUP_EDD_SWEEP_HEIGHT = 80           // 기둥 위 이 높이까지
const MOREUP_EDD_TAG = 'moreup_dragon_loot'
const MOREUP_EDD_VESSEL = 'paraglider:heart_container'

let moreupEddJobs = []                       // { x, y, z, age }
const moreupEddDone = new Set()

// 엔드 포탈 기둥 위 (가장 높은 블록 + 1)
function moreupEddPodiumY(level) {
    for (let y = 120; y > 0; y--) {
        let id = String(level.getBlock(0, y, 0).id)
        if (id !== 'minecraft:air' && id !== 'minecraft:void_air' && id !== 'minecraft:cave_air') return y + 1
    }
    return 65
}

function moreupEddEnd(server, cmd) {
    return server.runCommandSilent('execute in minecraft:the_end ' + cmd)
}

EntityEvents.death('minecraft:ender_dragon', event => {
    try {
        let dragon = event.entity
        if (String(dragon.level.dimension) !== 'minecraft:the_end') return
        let uuid = String(dragon.stringUuid)
        if (moreupEddDone.has(uuid)) return      // 한 번 죽을 때 이벤트가 두 번 오는 경우
        moreupEddDone.add(uuid)
        if (moreupEddDone.size > 64) moreupEddDone.clear()
        moreupEddJobs.push({ x: dragon.x, y: dragon.y, z: dragon.z, age: 0 })
    } catch (e) {
        console.error(`[MoreUp] 엔더 드래곤 처치 보상 처리 실패: ${e}`)
    }
})

ServerEvents.tick(event => {
    if (moreupEddJobs.length === 0) return
    try {
        let server = event.server
        moreupEddJobs.forEach(job => {
            job.age++
            if (job.age < MOREUP_EDD_DELIVER_AT && (job.age === 1 || job.age % MOREUP_EDD_FREEZE_EVERY === 0)) {
                let near = `distance=..${MOREUP_EDD_RADIUS}`
                let at = `positioned ${job.x.toFixed(2)} ${job.y.toFixed(2)} ${job.z.toFixed(2)}`
                ;['minecraft:item', 'minecraft:experience_orb'].forEach(type => {
                    // 치명타 자리
                    moreupEddEnd(server, `${at} run tag @e[type=${type},${near}] add ${MOREUP_EDD_TAG}`)
                    // 죽는 연출 중인 드래곤 주변 (경험치가 여기서 떨어진다)
                    moreupEddEnd(server, `as @e[type=minecraft:ender_dragon] at @s run tag @e[type=${type},${near}] add ${MOREUP_EDD_TAG}`)
                })
                moreupEddEnd(server, `as @e[tag=${MOREUP_EDD_TAG}] run data merge entity @s {NoGravity:1b,Motion:[0.0d,0.0d,0.0d]}`)
            }
            if (job.age === MOREUP_EDD_DELIVER_AT) {
                let top = moreupEddPodiumY(server.getLevel('minecraft:the_end'))
                let moved = moreupEddEnd(server, `run tp @e[tag=${MOREUP_EDD_TAG}] 0.5 ${top} 0.5`)
                moreupEddEnd(server, `as @e[tag=${MOREUP_EDD_TAG}] run data merge entity @s {Motion:[0.0d,0.0d,0.0d]}`)
                moreupEddEnd(server, `run tag @e[tag=${MOREUP_EDD_TAG}] remove ${MOREUP_EDD_TAG}`)
                let hasVessel = moreupEddEnd(server, `positioned 0.5 ${top} 0.5 if entity @e[type=minecraft:item,distance=..12,nbt={Item:{id:"${MOREUP_EDD_VESSEL}"}}]`) > 0
                if (!hasVessel) {
                    moreupEddEnd(server, `run summon minecraft:item 0.5 ${top} 0.5 {Item:{id:"${MOREUP_EDD_VESSEL}",Count:1b},Invulnerable:1b,NoGravity:1b,Motion:[0.0d,0.0d,0.0d],PickupDelay:20s,Tags:["moreup_keep"]}`)
                }
                console.info(`[MoreUp] 엔더 드래곤 처치 보상 ${moved}개를 포탈 위(y=${top})로 옮김, 하트 그릇 ${hasVessel ? 'Paraglider 가 떨굼' : '대신 떨굼'}`)
            }
            if (job.age === MOREUP_EDD_SWEEP_AT) {
                let top = moreupEddPodiumY(server.getLevel('minecraft:the_end'))
                let swept = moreupEddEnd(server, `run tp @e[type=minecraft:item,x=-3,y=${top + 2},z=-3,dx=7,dy=${MOREUP_EDD_SWEEP_HEIGHT},dz=7] 0.5 ${top} 0.5`)
                if (swept > 0) console.info(`[MoreUp] 엔더 드래곤 처치: 포탈 위 공중의 보상 ${swept}개를 기둥 위(y=${top})로 내림`)
            }
        })
        moreupEddJobs = moreupEddJobs.filter(job => job.age < MOREUP_EDD_SWEEP_AT)
    } catch (e) {
        console.error(`[MoreUp] 엔더 드래곤 처치 보상 이동 실패: ${e}`)
        moreupEddJobs = []
    }
})
