// priority: -10
// ============================================================
// More Up: 보스 처치 보상 (보스 정수)
// 경로: kubejs/server_scripts/systems/boss_rewards.js
//
// - 보스 티어표는 systems/boss_tiers.js 의 MOREUP_BOSS_TIERS 를 그대로 쓴다
//   (서버 스크립트끼리 최상위 변수를 공유하므로, 이 파일은 priority 를 낮춰 그 뒤에 읽는다).
// - 보스가 죽은 위치에서 64블록 안에 있는 플레이어 수만큼 보상을 떨어뜨린다. 플레이어가 없으면 주지 않는다.
// - 떨어진 정수는 폭발·용암에 사라지지 않고(Invulnerable, 화염 저항), 바닥 아이템 자동 청소에서 제외된다(moreup_keep 태그).
// 표를 바꾼 뒤 /reload 하면 적용된다.
// ============================================================

const MOREUP_ESSENCE_IDS = {
    low: 'moreup:boss_essence_low',
    mid: 'moreup:boss_essence_mid',
    high: 'moreup:boss_essence_high',
    legendary: 'moreup:boss_essence_legendary'
}

// 보스 정수 개수 배율 (2026-10-24 사용자 요청: 2배 → 2026-10-27 정수 획득처 대폭 증가: 3배). 아래 표와 최종 보스 보상의 "정수" 개수에만 곱한다
const MOREUP_ESSENCE_MULTIPLIER = 3

// 티어별 기본 보상: [정수 등급, 플레이어 1명당 개수] (배율 적용 전)
const MOREUP_REWARD_BY_TIER = {
    10: ['low', 1], 9: ['low', 1], 8: ['low', 2],
    7: ['mid', 1], 6: ['mid', 2],
    5: ['high', 1], 4: ['high', 2],
    3: ['legendary', 1], 2: ['legendary', 2], 1: ['legendary', 3]
}

// 보스별 예외
//   chance: 플레이어마다 보상을 받을 확률 (반복 소환·자연 스폰되는 몹, 여러 마리가 한 세트인 보스)
//   items : 기본 보상 대신 줄 [아이템 ID, 플레이어 1명당 개수] 목록
const MOREUP_REWARD_OVERRIDES = {
    'twilightforest:knight_phantom': { chance: 0.34 },      // 6마리 연전이라 합계가 2마리분 정도가 되게
    'minecraft:warden': { chance: 0.25 },                    // 슈리커로 반복 소환 가능
    'upgrade_aquatic:great_thrasher': { chance: 0.5 },       // 바다에서 자연 스폰
    'illagerinvasion:invoker': { chance: 0.5 },              // 습격·구조물에서 반복 등장
    'friendsandfoes:wildfire': { chance: 0.5 },              // 보루에서 반복 등장
    // 최종 보스 (원래는 아이템 드롭이 전혀 없음). 성주의 왕관은 최종 아이템 "모어 업"의 재료
    'twilight_forest_final_boss:castle_keeper': {
        items: [
            ['moreup:keepers_crown', 1],
            ['moreup:dusk_shard', 40],              // 황혼의 조각: 조각 8 + 전설 정수 1 → 황혼의 파편 (recipes/dusk_gear.js)
            ['moreup:boss_essence_legendary', 5],
            ['minecraft:nether_star', 2],
            ['minecraft:enchanted_golden_apple', 1],
            ['minecraft:experience_bottle', 32]
        ]
    }
}

const MOREUP_REWARD_RADIUS = 64

function moreupNearbyPlayers(server, entity) {
    let dim = String(entity.level.dimension)
    let found = []
    server.playerList.players.forEach(p => {
        if (String(p.level.dimension) !== dim) return
        let dx = p.x - entity.x, dy = p.y - entity.y, dz = p.z - entity.z
        if (dx * dx + dy * dy + dz * dz <= MOREUP_REWARD_RADIUS * MOREUP_REWARD_RADIUS) found.push(p)
    })
    return found
}

// 같은 자리에 아이템 엔티티를 소환한다 (64개 단위로 나눠서)
function moreupDropItem(server, entity, itemId, count) {
    let dim = String(entity.level.dimension)
    let x = entity.x.toFixed(2), y = (entity.y + 0.5).toFixed(2), z = entity.z.toFixed(2)
    while (count > 0) {
        let n = Math.min(64, count)
        server.runCommandSilent(`execute in ${dim} run summon minecraft:item ${x} ${y} ${z} {Item:{id:"${itemId}",Count:${n}b},Tags:["moreup_keep"],Invulnerable:1b,PickupDelay:20s}`)
        count -= n
    }
}

// playerCountOverride: 테스트용 (지정하면 주변 플레이어 수 대신 이 값을 쓴다)
function moreupGiveBossReward(server, entity, id, tier, playerCountOverride) {
    let players = playerCountOverride === undefined ? moreupNearbyPlayers(server, entity) : []
    let playerCount = playerCountOverride === undefined ? players.length : playerCountOverride
    if (playerCount <= 0) return 0

    let override = MOREUP_REWARD_OVERRIDES[id] || {}
    let rewards
    if (override.items) {
        rewards = override.items
    } else {
        let base = MOREUP_REWARD_BY_TIER[tier]
        if (!base) return 0
        rewards = [[MOREUP_ESSENCE_IDS[base[0]], base[1]]]
    }
    let chance = override.chance === undefined ? 1 : override.chance

    // 확률은 플레이어마다 따로 굴린다
    let receivers = 0
    for (let i = 0; i < playerCount; i++) {
        if (Math.random() < chance) receivers++
    }
    if (receivers === 0) return 0

    for (let i = 0; i < rewards.length; i++) {
        let itemId = rewards[i][0]
        let mult = itemId.indexOf('moreup:boss_essence_') === 0 ? MOREUP_ESSENCE_MULTIPLIER : 1
        moreupDropItem(server, entity, itemId, rewards[i][1] * receivers * mult)
    }
    players.forEach(p => p.tell(`§6[보스 처치] §f보상이 떨어졌습니다. (${receivers}명분)`))
    return receivers
}

// 일부 보스(트와일라잇 나가 등)는 한 번 죽을 때 사망 이벤트가 두 번 발생해서(테스트 서버에서 확인),
// 같은 개체에 보상이 두 번 나가지 않도록 최근 1분 동안 보상한 개체 UUID를 기억한다
const moreupRewardedRecently = {}
function moreupAlreadyRewarded(entity) {
    let now = Date.now()
    for (let key in moreupRewardedRecently) {
        if (now - moreupRewardedRecently[key] > 60000) delete moreupRewardedRecently[key]
    }
    let uuid = String(entity.stringUuid)
    if (moreupRewardedRecently[uuid]) return true
    moreupRewardedRecently[uuid] = now
    return false
}

let moreupRewardErrorCount = 0
function moreupMakeRewardHandler(id, tier) {
    return event => {
        try {
            let server = Utils.server
            if (server && !moreupAlreadyRewarded(event.entity)) moreupGiveBossReward(server, event.entity, id, tier)
        } catch (e) {
            if (moreupRewardErrorCount < 5) {
                moreupRewardErrorCount++
                console.error(`[MoreUp] 보스 보상 처리 실패 (${id}, ${moreupRewardErrorCount}/5): ${e}`)
            }
        }
    }
}

if (typeof MOREUP_BOSS_TIERS === 'undefined') {
    console.error('[MoreUp] MOREUP_BOSS_TIERS 를 찾을 수 없어 보스 보상을 등록하지 않았습니다. systems/boss_tiers.js 를 확인하세요.')
} else {
    let registered = 0
    for (let tierKey in MOREUP_BOSS_TIERS) {
        let tier = Number(tierKey)
        let ids = MOREUP_BOSS_TIERS[tierKey]
        for (let i = 0; i < ids.length; i++) {
            let id = ids[i]
            if (!$MoreUpTierRegistries.ENTITY_TYPES.containsKey(new $MoreUpTierRL(id))) continue
            EntityEvents.death(id, moreupMakeRewardHandler(id, tier))
            registered++
        }
    }
    console.info(`[MoreUp] 보스 보상 등록: ${registered}종`)
}
