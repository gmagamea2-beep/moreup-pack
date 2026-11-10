// priority: 0
// ============================================================
// More Up: Progressive Bosses 위더의 보스 정수 보상 복구 (2026-11-11 사용자 보고 "보스 확정 드랍이 안 나옴")
// 경로: kubejs/server_scripts/loot/progressive_wither_reward.js
//
// 이 팩에서 소환한 위더는 Progressive Bosses 의 progressivebosses:wither 다 (wither_eye_fix.js 참고).
// MoreUpCore 보스 표(bosses.json)에는 minecraft:wither(티어 5)만 있어서 위더를 잡아도 보스 정수가 나오지 않았다
// (시험 서버에서 확인: 다른 보스 15종은 정수가 나오고 위더만 0개).
// 표에 progressivebosses:wither 를 넣으면 체력·피해 배율과 별빛 도감 수까지 바뀌므로, 보상만 Core 와 같은 규칙으로 떨군다.
//   - 받는 사람: 위더에서 64칸 안의 관전 모드가 아닌 플레이어 (Core reward_radius)
//   - 1명당 상급 보스 정수 1개 x 정수 배율 3 (Core reward_by_tier 5 = ["high", 1], essence_multiplier 3)
//   - 바닥 아이템 자동 청소에서 빠지게 moreup_keep 태그, 무적
// Core 표가 바뀌면 이 값도 같이 맞춘다.
// ============================================================

const MOREUP_PBW_RADIUS = 64
const MOREUP_PBW_ITEM = 'moreup:boss_essence_high'
const MOREUP_PBW_PER_PLAYER = 1 * 3
const MOREUP_PBW_STACK = 64
const moreupPbwDone = new Set()

EntityEvents.death('progressivebosses:wither', event => {
    try {
        let entity = event.entity
        let uuid = String(entity.stringUuid)
        // 한 번 죽을 때 사망 이벤트가 두 번 오는 보스가 있다
        if (moreupPbwDone.has(uuid)) return
        moreupPbwDone.add(uuid)
        if (moreupPbwDone.size > 64) moreupPbwDone.clear()

        let receivers = []
        entity.level.players.forEach(p => {
            let spectator = false
            try { spectator = p.isSpectator() } catch (e) { }
            if (spectator) return
            let dx = p.x - entity.x, dy = p.y - entity.y, dz = p.z - entity.z
            if (dx * dx + dy * dy + dz * dz <= MOREUP_PBW_RADIUS * MOREUP_PBW_RADIUS) receivers.push(p)
        })
        if (receivers.length === 0) return

        let dim = String(entity.level.dimension)
        let x = entity.x.toFixed(2), y = (entity.y + 0.5).toFixed(2), z = entity.z.toFixed(2)
        let left = MOREUP_PBW_PER_PLAYER * receivers.length
        while (left > 0) {
            let n = Math.min(MOREUP_PBW_STACK, left)
            let ok = entity.server.runCommandSilent(`execute in ${dim} run summon minecraft:item ${x} ${y} ${z} {Item:{id:"${MOREUP_PBW_ITEM}",Count:${n}b},Tags:["moreup_keep"],Invulnerable:1b,PickupDelay:20s}`)
            if (!ok) console.error(`[MoreUp] 위더 보스 정수 summon 실패 (${dim} ${x} ${y} ${z})`)
            left -= n
        }
        // Core 와 같은 안내 문구 (moreup.boss.reward 는 MoreUpCore 언어 파일)
        receivers.forEach(p => p.tell(Text.translate('moreup.boss.reward', String(receivers.length)).gold()))
        console.info(`[MoreUp] 위더 보스 정수 ${MOREUP_PBW_PER_PLAYER * receivers.length}개 (${receivers.length}명)`)
    } catch (e) {
        console.error(`[MoreUp] 위더 보스 정수 보상 실패: ${e}`)
    }
})
