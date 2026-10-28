// priority: 0
// ============================================================
// More Up: 황혼의 인장 — 최종 보스 모어 소환
// 경로: kubejs/server_scripts/systems/dusk_sigil.js
//
// Twilight Forest Final Boss 모드에는 모어(castle_keeper)의 자연 스폰·소환 수단이 없다(생성 알뿐).
// 성주의 왕관(모어 업 재료)과 황혼의 조각을 얻을 수 있도록, 황혼의 숲에서 인장을 쓰면 모어를 소환한다.
// - 황혼의 숲 차원에서만, 반경 128블록 안에 모어가 없을 때만 소환된다 (중복 소환 방지)
// - 플레이어가 바라보는 방향 10블록 앞에 소환. 체력 100000·피해 x2는 boss_tiers.js / moreup_boss_damage.js 가 적용
// ============================================================

const MOREUP_DUSK_SIGIL_DIMENSION = 'twilightforest:twilight_forest'
const MOREUP_DUSK_BOSS_ID = 'twilight_forest_final_boss:castle_keeper'
const MOREUP_DUSK_SIGIL_CHECK_RADIUS = 128
const MOREUP_DUSK_SIGIL_COOLDOWN_TICKS = 100

ItemEvents.rightClicked('moreup:dusk_sigil', event => {
    let player = event.player
    let server = event.server
    if (!player || !server) return
    event.cancel()
    try {
        if (String(player.level.dimension) !== MOREUP_DUSK_SIGIL_DIMENSION) {
            player.tell(Text.translate('message.moreup.dusk_sigil.wrong_dimension').red())
            return
        }
        let uuid = player.stringUuid
        // 이미 근처에 모어가 있으면 소환하지 않는다 (결과 0 = 없음)
        let existing = server.runCommandSilent(
            `execute as ${uuid} at @s if entity @e[type=${MOREUP_DUSK_BOSS_ID},distance=..${MOREUP_DUSK_SIGIL_CHECK_RADIUS}]`)
        if (existing > 0) {
            player.tell(Text.translate('message.moreup.dusk_sigil.already').red())
            return
        }
        server.runCommandSilent(`execute as ${uuid} at @s anchored eyes positioned ^ ^ ^10 run summon ${MOREUP_DUSK_BOSS_ID} ~ ~ ~`)
        server.runCommandSilent(`execute as ${uuid} at @s run playsound minecraft:entity.wither.spawn hostile @a[distance=..64] ~ ~ ~ 1 0.6`)
        server.tell(Text.translate('message.moreup.dusk_sigil.summoned', player.displayName).lightPurple())
        if (!player.isCreative()) event.item.shrink(1)
        player.cooldowns.addCooldown(event.item.item, MOREUP_DUSK_SIGIL_COOLDOWN_TICKS)
    } catch (e) {
        console.error(`[MoreUp] 황혼의 인장 소환 실패 (${player.username}): ${e}`)
    }
})
