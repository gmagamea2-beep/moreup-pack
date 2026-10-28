// priority: 10
// ============================================================
// More Up: 보스가 주는 피해 배율 + 보스 무적 시간 제거
// 경로: kubejs/startup_scripts/moreup_boss_damage.js
//
// 1) 공격력 속성(generic.attack_damage)은 근접 공격에만 적용되므로,
//    Forge LivingHurtEvent 에서 "이 보스가 원인인 모든 피해"(근접, 투사체, 발구르기, 브레스 등)를 곱한다.
//    방어구 계산 전 피해에 곱한다. 보스가 소환한 하수인의 피해는 포함하지 않는다.
// 2) 맞은 뒤 무적 시간(0.5초)을 없앨 보스 (2026-10-23 사용자 결정, 계산은 MoreUp/docs/boss_fight_more.md)
//    바닐라 무적 시간 때문에 인원이 많아도 초당 약 2타만 들어가 체력 100000을 깎는 데 30분 넘게 걸렸다.
//    플레이어(또는 플레이어가 쏜 투사체)가 때렸을 때만 0으로 돌려, 여러 명이 동시에 때린 피해가 모두 들어가게 한다.
//    LivingEntity#hurt 는 invulnerableTime = 20 을 넣은 뒤 actuallyHurt(→ LivingHurtEvent)를 부르므로 여기서 덮어쓰면 된다.
//
// KubeJS 6 의 EntityEvents.hurt 는 피해량을 바꿀 수 없어 Forge 이벤트를 쓴다 (startup 전용).
// 값을 바꾼 뒤에는 게임/서버를 재시작해야 한다.
// ============================================================

const MOREUP_BOSS_DAMAGE_MULTIPLIERS = {
    'twilight_forest_final_boss:castle_keeper': 2.0 // 최종 보스
}
const MOREUP_NO_IFRAME_BOSSES = {
    'twilight_forest_final_boss:castle_keeper': true // 최종 보스 (10명이 동시에 때리면 약 7분)
}

const $MoreUpIframePlayer = Java.loadClass('net.minecraft.world.entity.player.Player')
let moreupBossDamageErrorCount = 0
let moreupIframeMode = null   // 'field' | 'reflect' | 'none' (처음 쓸 때 한 번 정한다)
let moreupIframeField = null

// 무적 시간을 0으로. KubeJS 6 는 일부 Mojmap 필드 이름을 못 찾으므로 실패하면 SRG 이름 리플렉션으로 바꾼다
function moreupClearIframes(entity) {
    if (moreupIframeMode === null) {
        try {
            entity.invulnerableTime = 0
            if (Number(entity.invulnerableTime) === 0) moreupIframeMode = 'field'
        } catch (e) { }
        if (moreupIframeMode === null) {
            try {
                // Forge 1.20.1 실행 환경의 SRG 이름: Entity.invulnerableTime = f_19802_
                moreupIframeField = Java.loadClass('net.minecraft.world.entity.Entity').__javaObject__.getDeclaredField('f_19802_')
                moreupIframeField.setAccessible(true)
                moreupIframeMode = 'reflect'
            } catch (e) {
                moreupIframeMode = 'none'
                console.error(`[MoreUp] 보스 무적 시간 제거를 쓸 수 없습니다: ${e}`)
            }
        }
        console.info(`[MoreUp] 보스 무적 시간 제거 방식: ${moreupIframeMode}`)
    }
    if (moreupIframeMode === 'field') entity.invulnerableTime = 0
    else if (moreupIframeMode === 'reflect') moreupIframeField.setInt(entity, 0)
}

ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', event => {
    try {
        // 가장 흔한 경우(원인 엔티티 없음)를 먼저 걸러낸다
        // getActual() = 피해의 실제 원인(투사체면 쏜 엔티티). DamageSource#getEntity 는 KubeJS 6 에서 이름이 매핑되지 않는다
        let attacker = event.getSource().getActual()
        if (attacker == null) return
        if (attacker instanceof $MoreUpIframePlayer) {
            let target = event.getEntity()
            if (target != null && MOREUP_NO_IFRAME_BOSSES[String(target.type)]) moreupClearIframes(target)
            return
        }
        let multiplier = MOREUP_BOSS_DAMAGE_MULTIPLIERS[String(attacker.type)]
        if (multiplier === undefined) return
        event.setAmount(event.getAmount() * multiplier)
    } catch (e) {
        if (moreupBossDamageErrorCount < 5) {
            moreupBossDamageErrorCount++
            console.error(`[MoreUp] 보스 피해 처리 실패 (${moreupBossDamageErrorCount}/5): ${e}`)
        }
    }
})

console.info(`[MoreUp] 보스 피해 배율 ${Object.keys(MOREUP_BOSS_DAMAGE_MULTIPLIERS).length}종, 무적 시간 제거 ${Object.keys(MOREUP_NO_IFRAME_BOSSES).length}종 등록`)
