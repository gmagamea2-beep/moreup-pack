// priority: 10
// ============================================================
// More Up: 황혼 장비 (최종 보스 "영원한 황혼의 군주 모어" 이후 콘텐츠)
// 경로: kubejs/startup_scripts/moreup_dusk_gear.js
// 설계: MoreUp/docs/dusk_gear.md
//
//   모어 처치 → 황혼의 조각(플레이어당 40) + 전설 보스 정수(5)
//   황혼의 조각 8 + 전설 정수 1 → 황혼의 파편
//   황혼의 파편 → 무기(클로·창·검·활·대검), 방어구(왕관·망토·갑주·각반·신발)
//   황혼의 인장 → 황혼의 숲에서 모어를 다시 소환 (server_scripts/systems/dusk_sigil.js)
//
// - 방어구 4부위는 ArmorItem 이라 moreup_armor_balance.js 의 x2 가 그대로 곱해진다 (아래 수치는 곱하기 전).
// - 망토는 Curios "back" 슬롯 장신구다 (config/curios-common.toml 에 back 1칸, 태그 curios:back). 방어구 x2 대상이 아니다.
// - 레시피: server_scripts/recipes/dusk_gear.js / 이름: kubejs/assets/moreup/lang/*.json
// 아이템 ID를 바꾸면 이미 만든 아이템이 월드에서 사라지므로 바꾸지 않는다. 수치를 바꾸면 재시작 필요.
// ============================================================

// 텍스처: kubejs/assets/moreup/textures/item/<id>.png (별들의 왕 콘셉트 원작 픽셀 아트, 생성기 MoreUp/textures_src/draw_dusk.ps1)
const MOREUP_DUSK_TOOL_TIER = 'moreup_dusk'
// 이름이 "모드ID:이름" 이면 착용 텍스처를 moreup:textures/models/armor/dusk_layer_1.png 에서 찾는다
const MOREUP_DUSK_ARMOR_TIER = 'moreup:dusk'

// 근접 무기: 표시 공격력 = 1 + damage, 공격 속도 = 4 + speed
// 실효 DPS(공격력 x 속도)는 기존 최종 무기(Spartan Cataclysm 약 34)보다 10~15% 높게 잡았다
const MOREUP_DUSK_MELEE = [
    { id: 'dusk_sword',      damage: 23, speed: -2.4, texture: 'moreup:item/dusk_sword' },            // 24 x 1.6 = 38.4
    { id: 'dusk_greatsword', damage: 39, speed: -3.0, texture: 'moreup:item/dusk_greatsword' }, // 40 x 1.0 = 40.0, 사거리 +1
    { id: 'dusk_claw',       damage: 14, speed: -1.4, texture: 'moreup:item/dusk_claw' },           // 15 x 2.6 = 39.0
    { id: 'dusk_spear',      damage: 26, speed: -2.6, texture: 'moreup:item/dusk_spear' }       // 27 x 1.4 = 37.8, 사거리 +2
]

// 무기별 추가 공격 사거리(forge:entity_reach, 블록)
const MOREUP_DUSK_REACH = {
    'moreup:dusk_greatsword': 1.0,
    'moreup:dusk_spear': 2.0
}

// 황혼의 활: 이 활로 쏜 화살의 기본 피해 배율 (바닐라 화살 기본 2 → 6, 완전히 당기면 약 18)
const MOREUP_DUSK_BOW_DAMAGE_MULTIPLIER = 3.0

// 방어구 (곱하기 전): 왕관 9 / 갑주 16 / 각반 13 / 신발 9 = 47, 방어 강도 부위당 6
// x2 적용 후 94 / 48 → 기존 최종 Cataclysm 이그니티움(94 / 47)과 같거나 조금 높고, 망토가 더해진다
const MOREUP_DUSK_ARMOR = [
    { id: 'dusk_crown',   type: 'helmet',     texture: 'moreup:item/dusk_crown' },
    { id: 'dusk_cuirass', type: 'chestplate', texture: 'moreup:item/dusk_cuirass' },
    { id: 'dusk_greaves', type: 'leggings',   texture: 'moreup:item/dusk_greaves' },
    { id: 'dusk_boots',   type: 'boots',      texture: 'moreup:item/dusk_boots' }
]

// 망토 (Curios back 슬롯): 방어구 x2 대상이 아니므로 최종 수치 그대로
const MOREUP_DUSK_CAPE_ATTRIBUTES = [
    // [속성, 값, 연산]
    ['minecraft:generic.armor', 6, 'ADDITION'],
    ['minecraft:generic.armor_toughness', 4, 'ADDITION'],
    ['minecraft:generic.max_health', 4, 'ADDITION'],          // 하트 2칸
    ['minecraft:generic.movement_speed', 0.08, 'MULTIPLY_BASE'] // 이동 속도 +8%
]

const $MoreUpDuskBowItem = Java.loadClass('net.minecraft.world.item.BowItem')
const $MoreUpDuskItemProperties = Java.loadClass('net.minecraft.world.item.Item$Properties')
const $MoreUpDuskRarity = Java.loadClass('net.minecraft.world.item.Rarity')
const $MoreUpDuskModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const $MoreUpDuskOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const $MoreUpDuskSlot = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')
const $MoreUpDuskForgeMod = Java.loadClass('net.minecraftforge.common.ForgeMod')
const $MoreUpDuskRegistries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')
const $MoreUpDuskRL = Java.loadClass('net.minecraft.resources.ResourceLocation')
const $MoreUpDuskUUID = Java.loadClass('java.util.UUID')
const $MoreUpDuskArrow = Java.loadClass('net.minecraft.world.entity.projectile.AbstractArrow')
const $MoreUpDuskPlayer = Java.loadClass('net.minecraft.world.entity.player.Player')

// 사거리 수정치 UUID (무기마다 고정, 바뀌면 중복 적용 위험)
const MOREUP_DUSK_REACH_UUID = $MoreUpDuskUUID.fromString('3f6d2c1e-5b7a-4e0c-9a51-7d2e8b4c6a10')
// 망토 속성 UUID (MOREUP_DUSK_CAPE_ATTRIBUTES 순서)
const MOREUP_DUSK_CAPE_UUIDS = [
    '3f6d2c1e-5b7a-4e0c-9a51-7d2e8b4c6a21',
    '3f6d2c1e-5b7a-4e0c-9a51-7d2e8b4c6a22',
    '3f6d2c1e-5b7a-4e0c-9a51-7d2e8b4c6a23',
    '3f6d2c1e-5b7a-4e0c-9a51-7d2e8b4c6a24'
].map(s => $MoreUpDuskUUID.fromString(s))

ItemEvents.toolTierRegistry(event => {
    event.add(MOREUP_DUSK_TOOL_TIER, tier => {
        tier.uses = 3000
        tier.speed = 9.0
        tier.attackDamageBonus = 0
        tier.level = 4
        tier.enchantmentValue = 18
        tier.repairIngredient = 'minecraft:netherite_ingot'
    })
})

ItemEvents.armorTierRegistry(event => {
    event.add(MOREUP_DUSK_ARMOR_TIER, tier => {
        tier.durabilityMultiplier = 45            // 네더라이트 37
        tier.slotProtections = [9, 13, 16, 9]     // 신발, 각반, 갑주, 왕관
        tier.enchantmentValue = 18
        tier.equipSound = 'minecraft:item.armor.equip_netherite'
        tier.repairIngredient = 'minecraft:netherite_ingot'
        tier.toughness = 6.0
        tier.knockbackResistance = 0.15
    })
})

StartupEvents.registry('item', event => {
    // ---------- 재료 ----------
    event.create('moreup:dusk_shard')
        .texture('moreup:item/dusk_shard')
        .rarity('rare')
        .fireResistant(true)
        .tooltip(Text.translate('tooltip.moreup.dusk_shard').gray())

    event.create('moreup:dusk_fragment')
        .texture('moreup:item/dusk_fragment')
        .rarity('epic')
        .glow(true)
        .fireResistant(true)
        .tooltip(Text.translate('tooltip.moreup.dusk_fragment').gray())

    event.create('moreup:dusk_sigil')
        .texture('moreup:item/dusk_sigil')
        .maxStackSize(16)
        .rarity('epic')
        .glow(true)
        .fireResistant(true)
        .tooltip(Text.translate('tooltip.moreup.dusk_sigil').gray())

    // ---------- 근접 무기 ----------
    MOREUP_DUSK_MELEE.forEach(w => {
        event.create(`moreup:${w.id}`, 'sword')
            .tier(MOREUP_DUSK_TOOL_TIER)
            .attackDamageBaseline(w.damage)
            .speedBaseline(w.speed)
            .texture(w.texture)
            .rarity('epic')
            .fireResistant(true)
            .tooltip(Text.translate(`tooltip.moreup.${w.id}`).gray())
    })

    // ---------- 활 (KubeJS 6에는 활 빌더가 없어 바닐라 BowItem 을 그대로 등록) ----------
    event.createCustom('moreup:dusk_bow', () => new $MoreUpDuskBowItem(
        new $MoreUpDuskItemProperties().durability(1800).fireResistant().rarity($MoreUpDuskRarity.EPIC)
    ))

    // ---------- 방어구 ----------
    MOREUP_DUSK_ARMOR.forEach(a => {
        event.create(`moreup:${a.id}`, a.type)
            .tier(MOREUP_DUSK_ARMOR_TIER)
            .texture(a.texture)
            .rarity('epic')
            .fireResistant(true)
            .tooltip(Text.translate(`tooltip.moreup.${a.id}`).gray())
    })

    // 망토: Curios 장신구 (능력치는 아래 CurioAttributeModifierEvent)
    event.create('moreup:dusk_cape')
        .texture('moreup:item/dusk_cape')
        .maxStackSize(1)
        .rarity('epic')
        .fireResistant(true)
        .tooltip(Text.translate('tooltip.moreup.dusk_cape').gray())
})

let moreupDuskErrorCount = 0
function moreupDuskLogError(where, e) {
    if (moreupDuskErrorCount < 5) {
        moreupDuskErrorCount++
        console.error(`[MoreUp] 황혼 장비 처리 실패 (${where}, ${moreupDuskErrorCount}/5): ${e}`)
    }
}

// 창·대검 공격 사거리
ForgeEvents.onEvent('net.minecraftforge.event.ItemAttributeModifierEvent', event => {
    try {
        if (!$MoreUpDuskSlot.MAINHAND.equals(event.getSlotType())) return
        let stack = event.getItemStack()
        if (stack.isEmpty()) return
        let reach = MOREUP_DUSK_REACH[String(stack.getId())]
        if (!reach) return
        event.addModifier($MoreUpDuskForgeMod.ENTITY_REACH.get(), new $MoreUpDuskModifier(
            MOREUP_DUSK_REACH_UUID, 'More Up dusk reach', reach, $MoreUpDuskOperation.ADDITION))
    } catch (e) {
        moreupDuskLogError('사거리', e)
    }
})

// 망토 능력치 (Curios 가 장신구 슬롯 능력치를 계산할 때 호출, 툴팁에도 표시된다)
ForgeEvents.onEvent('top.theillusivec4.curios.api.event.CurioAttributeModifierEvent', event => {
    try {
        let stack = event.getItemStack()
        if (stack.isEmpty() || String(stack.getId()) !== 'moreup:dusk_cape') return
        MOREUP_DUSK_CAPE_ATTRIBUTES.forEach((a, i) => {
            let attribute = $MoreUpDuskRegistries.ATTRIBUTES.getValue(new $MoreUpDuskRL(a[0]))
            if (attribute == null) return
            // 망토는 back 슬롯 1칸에만 들어가므로 속성마다 고정 UUID 를 쓴다 (같은 UUID 는 하나만 적용됨)
            event.addModifier(attribute, new $MoreUpDuskModifier(MOREUP_DUSK_CAPE_UUIDS[i], 'More Up dusk cape', a[1], $MoreUpDuskOperation.valueOf(a[2])))
        })
    } catch (e) {
        moreupDuskLogError('망토', e)
    }
})

// 황혼의 활로 쏜 화살 피해 상향 (서버에서만)
ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityJoinLevelEvent', event => {
    try {
        let entity = event.getEntity()
        if (!(entity instanceof $MoreUpDuskArrow) || event.getLevel().isClientSide()) return
        if (event.loadedFromDisk()) return
        let owner = entity.getOwner()
        if (!(owner instanceof $MoreUpDuskPlayer)) return
        // 화살이 생기는 순간에는 아직 활을 당기는 중(useItem)이다
        let using = owner.getUseItem()
        let isDuskBow = !using.isEmpty() && String(using.getId()) === 'moreup:dusk_bow'
        if (!isDuskBow) return
        entity.setBaseDamage(entity.getBaseDamage() * MOREUP_DUSK_BOW_DAMAGE_MULTIPLIER)
    } catch (e) {
        moreupDuskLogError('활', e)
    }
})

// ---------- 클라이언트: 활 당기기 애니메이션 ----------
// 바닐라는 "pull"/"pulling" 모델 속성을 기본 활에만 등록하므로 황혼의 활에도 등록한다
if (Platform.isClientEnvironment()) {
    ForgeModEvents.onEvent('net.minecraftforge.fml.event.lifecycle.FMLClientSetupEvent', event => {
        // enqueueWork 는 Runnable / Supplier 두 형태가 있어 Rhino 가 고르지 못한다 → 시그니처를 명시한다.
        // 여기서 예외가 나가면 모드 로딩 전체가 실패하므로 바깥도 try 로 감싼다 (활 애니메이션만 빠지고 게임은 켜진다)
        try {
        event['enqueueWork(java.lang.Runnable)'](() => {
            try {
                // JS 함수는 ClampedItemPropertyFunction 으로 변환되지 않는다(2026-10-22 클라이언트에서 확인).
                // 바닐라 활에 등록된 pull/pulling 함수(사용 중인 아이템 기준이라 어떤 활에도 맞음)를 그대로 재사용한다
                let $ItemProperties = Java.loadClass('net.minecraft.client.renderer.item.ItemProperties')
                let $Items = Java.loadClass('net.minecraft.world.item.Items')
                let bow = $MoreUpDuskRegistries.ITEMS.getValue(new $MoreUpDuskRL('moreup:dusk_bow'))
                ;['minecraft:pull', 'minecraft:pulling'].forEach(name => {
                    let key = new $MoreUpDuskRL(name)
                    let vanilla = $ItemProperties.getProperty($Items.BOW, key)
                    if (vanilla != null) $ItemProperties.register(bow, key, vanilla)
                })
            } catch (e) {
                console.error(`[MoreUp] 황혼의 활 모델 속성 등록 실패: ${e}`)
            }
        })
        } catch (e) {
            console.error(`[MoreUp] 황혼의 활 클라이언트 설정 예약 실패: ${e}`)
        }
    })
}

console.info('[MoreUp] 황혼 장비 등록: 재료 3, 무기 5, 방어구 4 + 망토')
