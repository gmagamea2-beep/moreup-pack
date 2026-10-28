// priority: 0
// ============================================================
// More Up: 보스 티어별 체력 배율
// 경로: kubejs/server_scripts/systems/boss_tiers.js
// 티어 기준표: MoreUp/docs/boss_tiers.md (10티어 = 입문, 1티어 = 최종 레이드)
//
// 배율 = 1 + 0.15 × (10 - 티어)
//   10티어 x1.00 / 9 x1.15 / 8 x1.30 / 7 x1.45 / 6 x1.60 / 5 x1.75 / 4 x1.90 / 3 x2.05 / 2 x2.20 / 1 x2.35
//
// 방식:
//   - 보스가 월드에 들어올 때(소환·자연 생성·청크 로드) 최대 체력에 MULTIPLY_TOTAL 수정치를 건다.
//     모드 설정(Cataclysm 체력 배율 등)으로 정해진 체력 위에 곱해진다.
//   - 고정 UUID를 써서 중복 적용되지 않는다. 배율을 바꾸면 다음에 들어올 때 새 값으로 교체된다.
//   - 남은 체력 비율은 유지한다 (새로 나온 보스는 가득 찬 상태, 저장돼 있던 보스는 같은 비율).
//   - 길들인 개체(Ice and Fire 펫 드래곤 등)에는 적용하지 않는다.
//   - EntityEvents.spawned 를 엔티티 종류별로 등록하므로 보스가 아닌 엔티티에는 스크립트가 실행되지 않는다.
//   - MOREUP_BOSS_HEALTH_OVERRIDES 에 있는 보스는 티어 배율 대신 최대 체력을 그 값으로 고정한다.
//   - 보스가 주는 피해 배율은 startup_scripts/moreup_boss_damage.js 에서 관리한다.
//
// 표를 바꾼 뒤 /reload 하면 이후 등장하는 보스부터 적용된다.
// ============================================================

const MOREUP_BOSS_TIER_STEP = 0.15
const MOREUP_BOSS_TIER_BASE = 10

// 최대 체력 고정값 (티어 배율보다 우선)
const MOREUP_BOSS_HEALTH_OVERRIDES = {
    'twilight_forest_final_boss:castle_keeper': 100000, // 최종 보스
    // Cataclysm 설정 체력 배율(22.22)과 1티어 배율이 겹쳐 23,498이던 것을 고정 (초당 피해 상한 14 → 최소 약 12분)
    'cataclysm:ignis': 10000
}

const MOREUP_BOSS_TIERS = {
    10: [
        'minecraft:elder_guardian', 'meetyourfight:swampjaw', 'twilightforest:naga', 'friendsandfoes:wildfire'
    ],
    9: [
        'twilightforest:lich', 'twilightforest:minoshroom', 'mowziesmobs:ferrous_wroughtnaut', 'meetyourfight:bellringer',
        'iceandfire:dread_lich', 'upgrade_aquatic:great_thrasher', 'bossominium:fallarota_boss'
    ],
    8: [
        'twilightforest:alpha_yeti', 'twilightforest:knight_phantom', 'aether:slider', 'mowziesmobs:umvuthi',
        'undergarden:forgotten_guardian', 'aquamirae:maze_mother', 'illagerinvasion:invoker',
        'cataclysm:coral_golem', 'cataclysm:ender_golem', 'cataclysm:wadjet'
    ],
    7: [
        'twilightforest:hydra', 'twilightforest:ur_ghast', 'twilightforest:snow_queen', 'aether:valkyrie_queen', 'mowziesmobs:sculptor',
        'cataclysm:the_prowler', 'cataclysm:coralssus', 'cataclysm:kobolediator', 'cataclysm:aptrgangr', 'cataclysm:amethyst_crab',
        'block_factorys_bosses:sandworm', 'block_factorys_bosses:yeti', 'theabyss:abyssaur', 'theabyss:elder',
        'bossominium:badlands_colossal_boss', 'bossominium:crypt_mummy_boss', 'bossominium:cultisager_boss', 'bossominium:drowned_king_boss',
        'bossominium:forest_guardian_boss', 'bossominium:fungal_brute_boss', 'bossominium:golden_ring_boss', 'bossominium:hell_hound_boss',
        'bossominium:morsemancer_boss', 'bossominium:netherrack_heart_boss', 'bossominium:purerman_boss', 'bossominium:redstone_turret_boss',
        'bossominium:skelenado_boss', 'bossominium:soul_reaper_boss', 'bossominium:strayed_warrior_boss', 'bossominium:vengeful_trader_boss',
        'bossominium:chorus_beast_boss'
    ],
    6: [
        'aether:sun_spirit', 'lost_aether_content:aerwhale_king', 'mowziesmobs:frostmaw', 'meetyourfight:dame_fortuna',
        'iceandfire:hydra', 'iceandfire:gorgon', 'iceandfire:cyclops', 'iceandfire:sea_serpent',
        'bosses_of_mass_destruction:lich', 'cataclysm:clawdian', 'stalwart_dungeons:awful_ghast',
        'bossominium:ancient_remnant_boss', 'bossominium:huntress_boss', 'bossominium:end_stone_sentinel_boss',
        'bossominium:ruin_boss', 'bossominium:moss_mech_boss'
    ],
    5: [
        'minecraft:wither', 'minecraft:ender_dragon', 'minecraft:warden',
        'bosses_of_mass_destruction:gauntlet', 'bosses_of_mass_destruction:void_blossom', 'aquamirae:captain_cornelia',
        'stalwart_dungeons:nether_keeper', 'stalwart_dungeons:shelterer', 'stalwart_dungeons:shelterer_without_armor',
        'block_factorys_bosses:infernal_dragon', 'block_factorys_bosses:underworld_knight', 'block_factorys_bosses:kraken',
        'theabyss:the_roka'
    ],
    4: [
        // Ice and Fire 드래곤은 엔티티 종류가 하나라 나이 단계와 관계없이 성체 기준 4티어로 묶었다
        'iceandfire:fire_dragon', 'iceandfire:ice_dragon', 'iceandfire:lightning_dragon',
        'bosses_of_mass_destruction:obsidilith', 'cataclysm:ender_guardian', 'cataclysm:the_harbinger', 'meetyourfight:rosalyne'
    ],
    3: [
        'cataclysm:netherite_monstrosity', 'cataclysm:ancient_remnant', 'cataclysm:the_leviathan', 'cataclysm:maledictus', 'cataclysm:scylla'
    ],
    2: [
        'theabyss:nightblade_boss'
    ],
    1: [
        'cataclysm:ignis', 'twilight_forest_final_boss:castle_keeper'
    ]
}

const $MoreUpTierAttributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
const $MoreUpTierModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')
const $MoreUpTierOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')
const $MoreUpTierRegistries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')
const $MoreUpTierRL = Java.loadClass('net.minecraft.resources.ResourceLocation')
const MOREUP_BOSS_HEALTH_UUID = Java.loadClass('java.util.UUID').fromString('6d0f3f0e-8a52-4d7b-9b2e-0c6f6a6b7a01')
const MOREUP_BOSS_HEALTH_NAME = 'More Up boss tier health'

let moreupBossTierErrorCount = 0

function moreupBossTierMultiplier(tier) {
    return 1 + MOREUP_BOSS_TIER_STEP * (MOREUP_BOSS_TIER_BASE - tier)
}

function moreupIsTamed(entity) {
    try {
        return typeof entity.isTame === 'function' && entity.isTame() === true
    } catch (e) {
        return false
    }
}

// amountFor(rawMax): 이 스크립트의 수정치를 뺀 최대 체력을 받아, 걸어야 할 MULTIPLY_TOTAL 값을 돌려준다.
// 반환값: 적용 전에 체력이 가득 차 있었으면 true (다음 틱에 다시 채울지 판단용)
function moreupApplyBossHealthModifier(entity, amountFor) {
    let instance = entity.getAttribute($MoreUpTierAttributes.MAX_HEALTH)
    if (!instance) return false

    let existing = instance.getModifier(MOREUP_BOSS_HEALTH_UUID)
    let oldMax = entity.getMaxHealth()
    let oldHealth = entity.getHealth()
    // MULTIPLY_TOTAL 은 곱으로 쌓이므로 우리 수정치만 나눠서 빼낼 수 있다
    let rawMax = existing ? oldMax / (1 + existing.getAmount()) : oldMax

    // 길들인 개체는 배율 없음 (예전에 걸린 수치가 있으면 제거)
    let amount = moreupIsTamed(entity) || rawMax <= 0 ? 0 : amountFor(rawMax)
    if (existing && Math.abs(existing.getAmount() - amount) < 0.000001) return false
    if (!existing && Math.abs(amount) < 0.000001) return false

    let wasFull = oldMax > 0 && oldHealth >= oldMax - 0.01
    if (existing) instance.removeModifier(MOREUP_BOSS_HEALTH_UUID)
    if (Math.abs(amount) >= 0.000001) {
        instance.addPermanentModifier(new $MoreUpTierModifier(
            MOREUP_BOSS_HEALTH_UUID, MOREUP_BOSS_HEALTH_NAME, amount, $MoreUpTierOperation.MULTIPLY_TOTAL
        ))
    }
    let newMax = entity.getMaxHealth()
    if (oldMax > 0 && oldHealth > 0) {
        entity.setHealth(Math.min(newMax, oldHealth * newMax / oldMax))
    }
    return wasFull
}

function moreupApplyBossTierHealth(entity, tier) {
    let multiplier = moreupBossTierMultiplier(tier)
    return moreupApplyBossHealthModifier(entity, rawMax => multiplier - 1)
}

function moreupApplyBossFixedHealth(entity, targetMax) {
    return moreupApplyBossHealthModifier(entity, rawMax => targetMax / rawMax - 1)
}

// Progressive Bosses 등 같은 시점에 체력을 다시 설정하는 모드가 있어(엔더 드래곤에서 확인)
// 가득 찬 상태로 들어온 보스는 다음 틱에 한 번 더 최대 체력으로 맞춘다
function moreupTopUpBossHealth(entity) {
    try {
        if (!entity.isAlive()) return
        let max = entity.getMaxHealth()
        if (entity.getHealth() < max) entity.setHealth(max)
    } catch (e) {
        console.error(`[MoreUp] 보스 체력 보정 실패: ${e}`)
    }
}

// 반복문 안에서 화살표 함수를 바로 만들면 Rhino에서 마지막 반복값을 공유할 수 있어 팩토리로 분리한다
function moreupMakeBossTierHandler(id, tier) {
    let fixedMax = MOREUP_BOSS_HEALTH_OVERRIDES[id]
    return event => {
        try {
            let entity = event.entity
            let wasFull = fixedMax !== undefined
                ? moreupApplyBossFixedHealth(entity, fixedMax)
                : moreupApplyBossTierHealth(entity, tier)
            if (wasFull) {
                let server = Utils.server
                if (server) server.scheduleInTicks(1, () => moreupTopUpBossHealth(entity))
            }
        } catch (e) {
            if (moreupBossTierErrorCount < 5) {
                moreupBossTierErrorCount++
                console.error(`[MoreUp] 보스 티어 체력 적용 실패 (${id}, ${moreupBossTierErrorCount}/5): ${e}`)
            }
        }
    }
}

let moreupBossTierRegistered = 0
let moreupBossTierMissing = []
for (let tierKey in MOREUP_BOSS_TIERS) {
    let tier = Number(tierKey)
    let ids = MOREUP_BOSS_TIERS[tierKey]
    for (let i = 0; i < ids.length; i++) {
        let id = ids[i]
        // 없는 엔티티 ID로 이벤트를 등록하면 스크립트 로딩이 실패하므로 레지스트리부터 확인한다
        if (!$MoreUpTierRegistries.ENTITY_TYPES.containsKey(new $MoreUpTierRL(id))) {
            moreupBossTierMissing.push(id)
            continue
        }
        EntityEvents.spawned(id, moreupMakeBossTierHandler(id, tier))
        moreupBossTierRegistered++
    }
}

console.info(`[MoreUp] 보스 티어 체력 배율 등록: ${moreupBossTierRegistered}종 (단계당 +${MOREUP_BOSS_TIER_STEP * 100}%)`)
if (moreupBossTierMissing.length > 0) {
    console.warn(`[MoreUp] 레지스트리에 없어 건너뛴 보스: ${moreupBossTierMissing.join(', ')}`)
}
