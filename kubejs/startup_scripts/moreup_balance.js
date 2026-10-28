// priority: 5
// ============================================================
// More Up: 전투 밸런스 (2026-10-26 패치, 2026-10-27 마법 상향)
// 경로: kubejs/startup_scripts/moreup_balance.js
//
// 1) 몹(플레이어가 아닌 모든 생명체, 투사체는 쏜 쪽 기준)이 플레이어에게 주는 피해를 15% 줄인다.
//    보스 피해 배율(moreup_boss_damage.js, 모어 x2)과 곱으로 함께 적용된다.
// 2) 플레이어가 쓴 주문(Electroblob's Wizardry Redux 와 애드온 Myth Wizardry)의 피해 x2 (2026-10-27 사용자 요청: 마법 공격력 대폭 증가)
//    주문 피해는 ebwizardry 피해 타입 10종(message_id 가 전부 "wizardry_" 로 시작)으로 들어온다. Myth Wizardry 도 같은 피해 타입을 쓴다.
//    플레이어끼리(PvP), 적 마법사가 플레이어에게 쓰는 주문에는 적용하지 않는다. 소환수(미니언)의 근접 공격은 주문이 아니라 그대로다.
// 방어력·방어 강도 +10% 는 server_scripts/systems/player_armor_bonus.js
// 값을 바꾼 뒤에는 게임/서버를 재시작해야 한다 (startup 스크립트).
// ============================================================

const MOREUP_MOB_DAMAGE_TO_PLAYER = 0.85
const MOREUP_PLAYER_SPELL_DAMAGE = 2.0
const MOREUP_SPELL_MSG_PREFIX = 'wizardry_'

const $MoreUpBalancePlayer = Java.loadClass('net.minecraft.world.entity.player.Player')
let moreupBalanceErrors = 0

// 피해 타입의 message_id. KubeJS 6 에서는 getMsgId() 를 찾지 못한다 → KubeJS 의 getType() (테스트 서버에서 확인, 2026-10-27)
function moreupIsSpellDamage(source) {
    let id = ''
    try {
        id = String(source.getType())
    } catch (e) {
        try { id = String(source.type().msgId()) } catch (e2) { id = '' }
    }
    return id.indexOf(MOREUP_SPELL_MSG_PREFIX) === 0
}

ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', event => {
    try {
        let target = event.getEntity()
        let source = event.getSource()
        let attacker = source.getActual()
        if (attacker instanceof $MoreUpBalancePlayer) {
            if (!(target instanceof $MoreUpBalancePlayer) && moreupIsSpellDamage(source)) {
                event.setAmount(event.getAmount() * MOREUP_PLAYER_SPELL_DAMAGE)
            }
            return
        }
        if (!(target instanceof $MoreUpBalancePlayer) || attacker == null) return
        event.setAmount(event.getAmount() * MOREUP_MOB_DAMAGE_TO_PLAYER)
    } catch (e) {
        if (moreupBalanceErrors < 5) {
            moreupBalanceErrors++
            console.error(`[MoreUp] 전투 밸런스 처리 실패 (${moreupBalanceErrors}/5): ${e}`)
        }
    }
})

console.info(`[MoreUp] 몹 → 플레이어 피해 배율 ${MOREUP_MOB_DAMAGE_TO_PLAYER}, 플레이어 주문 피해 배율 ${MOREUP_PLAYER_SPELL_DAMAGE}`)
