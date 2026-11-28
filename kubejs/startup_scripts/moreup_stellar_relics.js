// priority: 9
// ============================================================
// More Up: 별의 갑주 세트 효과 + 별의 장신구 6종 (1.14.4, 2026-11-26 사용자 요청 "세트효과 넣고 아티팩트들 더 추가")
// 경로: kubejs/startup_scripts/moreup_stellar_relics.js
// 설계: MoreUp/docs/stellar_armor.md
//
// 1) 세트 효과 「별빛 공명」 (별의 투구·흉갑·각반·장화 4부위를 모두 입었을 때)
//    - 최대 체력 +10, 근접 공격력 +8%, 이동 속도 +5% (장비가 바뀔 때마다 다시 계산하는 임시 수정치)
//    - 받는 피해 -10% (LivingHurtEvent, 방어구 계산 전)
//    - 「별의 장막」: 맞아서 체력이 30% 아래로 떨어지면 흡수 IV 10초 + 재생 II 5초, 재사용 대기 90초
// 2) 별의 장신구 6종 (Curios, 별의 조각 1개 + 재료, 레시피 server_scripts/recipes/stellar_armor.js)
//    같은 장신구 두 개는 겹치지 않는다(속성마다 고정 UUID → 같은 UUID 는 하나만 적용)
//    칸은 server_scripts/tags/stellar_tags.js 의 curios:<칸> 태그로 정한다.
//
// - 이 파일은 moreup_stellar_armor.js(갑주·조각 등록) 다음에 읽힌다. 갑주 아이템 ID 를 바꾸지 않는다.
// - startup 스크립트의 console.error 는 서버 시작을 멈출 수 있어 처리 실패는 console.warn 으로만 남긴다.
// 아이템 ID를 바꾸면 이미 만든 아이템이 월드에서 사라지므로 바꾸지 않는다. 수치를 바꾸면 재시작 필요.
// ============================================================

const $MoreUpStAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const $MoreUpStModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const $MoreUpStOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const $MoreUpStSlot = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')
const $MoreUpStForgeMod = Java.loadClass('net.minecraftforge.common.ForgeMod')
const $MoreUpStUUID = Java.loadClass('java.util.UUID')
const $MoreUpStPlayer = Java.loadClass('net.minecraft.world.entity.player.Player')
const $MoreUpStEffect = Java.loadClass('net.minecraft.world.effect.MobEffectInstance')
const $MoreUpStEffects = Java.loadClass('net.minecraft.world.effect.MobEffects')
const $MoreUpStCurios = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')

// ---------- 세트 효과 수치 ----------
const MOREUP_STELLAR_SET_PIECES = [
    [$MoreUpStSlot.HEAD, 'moreup:stellar_helmet'],
    [$MoreUpStSlot.CHEST, 'moreup:stellar_chestplate'],
    [$MoreUpStSlot.LEGS, 'moreup:stellar_leggings'],
    [$MoreUpStSlot.FEET, 'moreup:stellar_boots']
]
const MOREUP_STELLAR_SET_DAMAGE_TAKEN = 0.90        // 받는 피해 -10%
const MOREUP_STELLAR_VEIL_THRESHOLD = 0.30          // 체력 30% 아래로 떨어지면
const MOREUP_STELLAR_VEIL_COOLDOWN_MS = 90 * 1000   // 90초 (실제 시간. KubeJS 6 에서 level.getGameTime() 을 부를 수 없다 — 2026-11-26 시험 서버 확인)
const MOREUP_STELLAR_VEIL_KEY = 'moreupStellarVeil' // 플레이어 persistentData (죽으면 초기화돼도 괜찮은 값)

// [속성 getter, 값, 연산, 고정 UUID] — getter 는 레지스트리가 다 만들어진 뒤에 불러야 해서 함수로 둔다
const MOREUP_STELLAR_SET_BONUS = [
    [() => $MoreUpStAttributes.MAX_HEALTH, 10, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e01'],
    [() => $MoreUpStAttributes.ATTACK_DAMAGE, 0.08, 'MULTIPLY_TOTAL', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e02'],
    [() => $MoreUpStAttributes.MOVEMENT_SPEED, 0.05, 'MULTIPLY_BASE', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e03']
].map(a => [a[0], a[1], a[2], $MoreUpStUUID.fromString(a[3])])

// ---------- 장신구 ----------
// 별똥별 부적: 공격이 맞으면 이 확률로 피해 x배율
const MOREUP_STELLAR_CHARM_CHANCE = 0.20
const MOREUP_STELLAR_CHARM_MULTIPLIER = 1.4

// id, 칸(설명용 — 실제 칸은 태그), 속성 [getter, 값, 연산, UUID]
const MOREUP_STELLAR_RELICS = [
    { id: 'stellar_ring', slot: 'ring', attributes: [
        [() => $MoreUpStAttributes.ATTACK_DAMAGE, 3, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e11'],
        [() => $MoreUpStAttributes.ATTACK_SPEED, 0.06, 'MULTIPLY_BASE', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e12']] },
    { id: 'stellar_pendant', slot: 'necklace', attributes: [
        [() => $MoreUpStAttributes.MAX_HEALTH, 8, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e21'],
        [() => $MoreUpStAttributes.ARMOR_TOUGHNESS, 2, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e22']] },
    { id: 'stellar_belt', slot: 'belt', attributes: [
        [() => $MoreUpStAttributes.ARMOR, 4, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e31'],
        [() => $MoreUpStAttributes.KNOCKBACK_RESISTANCE, 0.2, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e32'],
        [() => $MoreUpStAttributes.MAX_HEALTH, 4, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e33']] },
    { id: 'stellar_gauntlet', slot: 'hands', attributes: [
        [() => $MoreUpStAttributes.ATTACK_DAMAGE, 2, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e41'],
        [() => $MoreUpStAttributes.ATTACK_KNOCKBACK, 0.5, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e42'],
        [() => $MoreUpStForgeMod.ENTITY_REACH.get(), 0.5, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e43']] },
    { id: 'stellar_anklet', slot: 'feet', attributes: [
        [() => $MoreUpStAttributes.MOVEMENT_SPEED, 0.10, 'MULTIPLY_BASE', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e51'],
        [() => $MoreUpStForgeMod.STEP_HEIGHT_ADDITION.get(), 0.5, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e52']] },
    { id: 'stellar_charm', slot: 'charm', attributes: [
        [() => $MoreUpStAttributes.LUCK, 1, 'ADDITION', '8c1f4a2e-6d3b-4f70-9e15-2a7b3c4d5e61']] }
]
MOREUP_STELLAR_RELICS.forEach(r => { r.attributes = r.attributes.map(a => [a[0], a[1], a[2], $MoreUpStUUID.fromString(a[3])]) })
const MOREUP_STELLAR_RELIC_BY_ID = {}
MOREUP_STELLAR_RELICS.forEach(r => { MOREUP_STELLAR_RELIC_BY_ID[`moreup:${r.id}`] = r })

StartupEvents.registry('item', event => {
    MOREUP_STELLAR_RELICS.forEach(r => {
        event.create(`moreup:${r.id}`)
            .texture(`moreup:item/${r.id}`)   // 생성기 MoreUp/textures_src/draw_stellar.ps1
            .maxStackSize(1)
            .rarity('epic')
            .fireResistant(true)
            .tooltip(Text.translate(`tooltip.moreup.${r.id}`).gray())
    })
})

let moreupStellarErrorCount = 0
function moreupStellarWarn(where, e) {
    if (moreupStellarErrorCount < 10) {
        moreupStellarErrorCount++
        console.warn(`[MoreUp] 별의 갑주·장신구 처리 실패 (${where}, ${moreupStellarErrorCount}/10): ${e}`)
    }
}

function moreupStellarHasFullSet(entity) {
    for (let i = 0; i < MOREUP_STELLAR_SET_PIECES.length; i++) {
        let stack = entity.getItemBySlot(MOREUP_STELLAR_SET_PIECES[i][0])
        if (stack.isEmpty() || String(stack.getId()) !== MOREUP_STELLAR_SET_PIECES[i][1]) return false
    }
    return true
}

// 별똥별 부적 착용 여부: 공격할 때마다 장신구 칸 전체를 훑지 않도록 1초 캐시 (플레이어 UUID 문자열 키, 퇴장 시 삭제)
const moreupStellarCharmCache = {}
function moreupStellarHasCharm(player) {
    let key = String(player.stringUuid)
    let now = Date.now()
    let cached = moreupStellarCharmCache[key]
    if (cached && now - cached.t < 1000 && now >= cached.t) return cached.v
    let found = false
    let opt = $MoreUpStCurios.getCuriosInventory(player).resolve()
    if (opt.isPresent()) {
        let inv = opt.get().getEquippedCurios()
        for (let i = 0; i < inv.getSlots(); i++) {
            let s = inv.getStackInSlot(i)
            if (!s.isEmpty() && String(s.getId()) === 'moreup:stellar_charm') { found = true; break }
        }
    }
    moreupStellarCharmCache[key] = { t: now, v: found }
    return found
}

// 세트 효과 속성: 서버에서 장비가 바뀔 때마다(접속·부활 직후 첫 틱 포함) 다시 계산한다.
// 임시(transient) 수정치라 저장되지 않으므로 접속할 때 다시 붙는다.
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingEquipmentChangeEvent', event => {
    try {
        let entity = event.getEntity()
        if (!(entity instanceof $MoreUpStPlayer) || entity.level.isClientSide()) return
        let slot = event.getSlot()
        if (!MOREUP_STELLAR_SET_PIECES.some(p => p[0].equals(slot))) return
        let full = moreupStellarHasFullSet(entity)
        MOREUP_STELLAR_SET_BONUS.forEach(b => {
            let instance = entity.getAttribute(b[0]())
            if (instance == null) return
            let has = instance.getModifier(b[3]) != null
            if (full && !has) instance.addTransientModifier(new $MoreUpStModifier(b[3], 'More Up stellar set', b[1], $MoreUpStOperation.valueOf(b[2])))
            else if (!full && has) instance.removeModifier(b[3])
        })
        // 최대 체력이 줄면 현재 체력을 맞춰 준다
        if (!full && entity.getHealth() > entity.getMaxHealth()) entity.setHealth(entity.getMaxHealth())
    } catch (e) {
        moreupStellarWarn('세트 속성', e)
    }
})

// 받는 피해 -10% (세트) / 별똥별 부적 추가 피해
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', event => {
    try {
        let target = event.getEntity()
        if (target.level.isClientSide()) return
        if (target instanceof $MoreUpStPlayer && moreupStellarHasFullSet(target)) {
            event.setAmount(event.getAmount() * MOREUP_STELLAR_SET_DAMAGE_TAKEN)
        }
        let attacker = event.getSource().getActual()   // DamageSource#getEntity 는 KubeJS 6 에서 매핑되지 않는다
        if (attacker instanceof $MoreUpStPlayer && !attacker.equals(target)
            && Math.random() < MOREUP_STELLAR_CHARM_CHANCE && moreupStellarHasCharm(attacker)) {
            event.setAmount(event.getAmount() * MOREUP_STELLAR_CHARM_MULTIPLIER)
        }
    } catch (e) {
        moreupStellarWarn('피해', e)
    }
})

// 별의 장막: 방어구·흡수 계산 뒤 실제로 깎일 체력 기준 (죽는 피해에는 발동하지 않는다)
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDamageEvent', event => {
    try {
        let player = event.getEntity()
        if (!(player instanceof $MoreUpStPlayer) || player.level.isClientSide()) return
        let after = player.getHealth() - event.getAmount()
        let max = player.getMaxHealth()
        if (after <= 0 || after > max * MOREUP_STELLAR_VEIL_THRESHOLD) return
        if (!moreupStellarHasFullSet(player)) return
        let now = Date.now()
        let data = player.persistentData
        let last = data.contains(MOREUP_STELLAR_VEIL_KEY) ? Number(data.getLong(MOREUP_STELLAR_VEIL_KEY)) : -1
        // 시계가 되돌아간 경우(last > now)도 사용 가능으로 본다
        if (last >= 0 && now >= last && now - last < MOREUP_STELLAR_VEIL_COOLDOWN_MS) return
        data.putLong(MOREUP_STELLAR_VEIL_KEY, now)
        player.addEffect(new $MoreUpStEffect($MoreUpStEffects.ABSORPTION, 200, 3))
        player.addEffect(new $MoreUpStEffect($MoreUpStEffects.REGENERATION, 100, 1))
        try { player.setStatusMessage(Text.translate('message.moreup.stellar_veil').aqua()) } catch (e2) { }
    } catch (e) {
        moreupStellarWarn('별의 장막', e)
    }
})

// 장신구 능력치 (Curios 가 장신구 칸 능력치를 계산할 때 호출, 툴팁에도 표시된다)
ForgeEvents.onEvent('top.theillusivec4.curios.api.event.CurioAttributeModifierEvent', event => {
    try {
        let stack = event.getItemStack()
        if (stack.isEmpty()) return
        let relic = MOREUP_STELLAR_RELIC_BY_ID[String(stack.getId())]
        if (!relic) return
        relic.attributes.forEach(a => {
            let attribute = a[0]()
            if (attribute == null) return
            event.addModifier(attribute, new $MoreUpStModifier(a[3], `More Up ${relic.id}`, a[1], $MoreUpStOperation.valueOf(a[2])))
        })
    } catch (e) {
        moreupStellarWarn('장신구 능력치', e)
    }
})

ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerLoggedOutEvent', event => {
    try { delete moreupStellarCharmCache[String(event.getEntity().stringUuid)] } catch (e) { }
})

console.info(`[MoreUp] 별의 갑주 세트 효과 + 별의 장신구 ${MOREUP_STELLAR_RELICS.length}종 등록`)
