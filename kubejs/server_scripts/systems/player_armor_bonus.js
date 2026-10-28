// priority: 0
// ============================================================
// More Up: 플레이어 방어력·방어 강도 +10% (2026-10-26 패치)
// 경로: kubejs/server_scripts/systems/player_armor_bonus.js
//
// 고정 UUID 의 MULTIPLY_TOTAL 수정치(+0.10)를 접속·부활 때 건다. 이미 같은 값이면 건드리지 않는다.
// 배율을 바꾸면 다음 접속부터 새 값으로 교체된다. 몹 피해 15% 감소는 startup_scripts/moreup_balance.js
// ============================================================

const MOREUP_ARMOR_BONUS = 0.10
const $MoreUpArmorAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const $MoreUpArmorModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const $MoreUpArmorOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const $MoreUpArmorUUID = Java.loadClass('java.util.UUID')
const MOREUP_ARMOR_BONUS_IDS = [
    [$MoreUpArmorAttributes.ARMOR, $MoreUpArmorUUID.fromString('6d0f3f0e-8a52-4d7b-9b2e-0c6f6a6b7a11'), 'More Up armor bonus'],
    [$MoreUpArmorAttributes.ARMOR_TOUGHNESS, $MoreUpArmorUUID.fromString('6d0f3f0e-8a52-4d7b-9b2e-0c6f6a6b7a12'), 'More Up armor toughness bonus']
]

function moreupApplyArmorBonus(player) {
    if (!player) return
    try {
        MOREUP_ARMOR_BONUS_IDS.forEach(entry => {
            let instance = player.getAttribute(entry[0])
            if (!instance) return
            let existing = instance.getModifier(entry[1])
            if (existing && Math.abs(existing.getAmount() - MOREUP_ARMOR_BONUS) < 0.000001) return
            if (existing) instance.removeModifier(entry[1])
            instance.addPermanentModifier(new $MoreUpArmorModifier(entry[1], entry[2], MOREUP_ARMOR_BONUS, $MoreUpArmorOperation.MULTIPLY_TOTAL))
        })
    } catch (e) {
        console.error(`[MoreUp] 방어력 보너스 적용 실패 (${player.username}): ${e}`)
    }
}

PlayerEvents.loggedIn(event => moreupApplyArmorBonus(event.player))
PlayerEvents.respawned(event => moreupApplyArmorBonus(event.player))
