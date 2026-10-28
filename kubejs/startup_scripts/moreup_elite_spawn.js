// priority: 0
// ============================================================
// More Up: 정예 몬스터 판정 (2026-10-28, 1.5.0 "모험의 시간")
// 경로: kubejs/startup_scripts/moreup_elite_spawn.js   적용·특성·보상: server_scripts/systems/elite_mobs.js
//
// 몹이 처음 생길 때(MobSpawnEvent.FinalizeSpawn) 확률을 굴려 정예가 될 몹에 표시(persistentData.moreupElite)만 남긴다.
// 실제 강화·이름·특성은 서버 스크립트가 몹이 월드에 들어올 때 붙인다.
//   대상: 적대 몹(Enemy), 자연·청크 생성·구조물·습격대·지원군·이벤트로 생긴 것만
//         (스포너·생성 알·명령어·변환·IF 복제기 등은 제외 → 몹 농장으로 정예를 찍어 내지 못하게)
//   제외: 최대 체력 150 이상(보스·중간 보스, 서버 스크립트가 보스 티어표로 한 번 더 거른다)
//   확률: 오버월드 3% + 월드 중심에서 1000블록마다 1% (최대 +5%), 네더 5%, 엔드·모드 차원 6%
//   특성 수: 85% 1개, 15% 2개 (특성 목록은 서버 스크립트 MOREUP_ELITE_AFFIXES 와 같은 키)
// 값을 바꾼 뒤에는 게임/서버를 재시작해야 한다 (startup 스크립트).
// ============================================================

const MOREUP_ELITE_CHANCE = { 'minecraft:overworld': 0.03, 'minecraft:the_nether': 0.05, 'minecraft:the_end': 0.06 }
const MOREUP_ELITE_CHANCE_OTHER = 0.06
const MOREUP_ELITE_DISTANCE_STEP = 1000
const MOREUP_ELITE_DISTANCE_BONUS = 0.01
const MOREUP_ELITE_DISTANCE_BONUS_MAX = 0.05
const MOREUP_ELITE_DOUBLE_CHANCE = 0.15
const MOREUP_ELITE_MAX_BASE_HEALTH = 150
const MOREUP_ELITE_SPAWN_TYPES = { NATURAL: true, CHUNK_GENERATION: true, STRUCTURE: true, PATROL: true, REINFORCEMENT: true, EVENT: true, JOCKEY: true }
const MOREUP_ELITE_AFFIX_KEYS = ['armored', 'berserk', 'swift', 'regenerating', 'blazing', 'venom', 'frost', 'vampiric', 'volatile']

const $MoreUpEliteEnemy = Java.loadClass('net.minecraft.world.entity.monster.Enemy')
let moreupEliteSpawnErrors = 0

ForgeEvents.onEvent('net.minecraftforge.event.entity.living.MobSpawnEvent$FinalizeSpawn', event => {
    try {
        let mob = event.getEntity()
        if (!(mob instanceof $MoreUpEliteEnemy)) return
        if (!MOREUP_ELITE_SPAWN_TYPES[String(event.getSpawnType())]) return
        if (mob.getMaxHealth() >= MOREUP_ELITE_MAX_BASE_HEALTH) return
        let dim = String(mob.level.dimension)
        let chance = MOREUP_ELITE_CHANCE.hasOwnProperty(dim) ? MOREUP_ELITE_CHANCE[dim] : MOREUP_ELITE_CHANCE_OTHER
        if (dim === 'minecraft:overworld') {
            let dist = Math.sqrt(event.getX() * event.getX() + event.getZ() * event.getZ())
            chance += Math.min(MOREUP_ELITE_DISTANCE_BONUS_MAX, Math.floor(dist / MOREUP_ELITE_DISTANCE_STEP) * MOREUP_ELITE_DISTANCE_BONUS)
        }
        if (Math.random() >= chance) return
        let keys = MOREUP_ELITE_AFFIX_KEYS.slice()
        let first = keys.splice(Math.floor(Math.random() * keys.length), 1)[0]
        let picked = [first]
        if (Math.random() < MOREUP_ELITE_DOUBLE_CHANCE) picked.push(keys[Math.floor(Math.random() * keys.length)])
        mob.persistentData.putString('moreupElite', picked.join(','))
    } catch (e) {
        if (moreupEliteSpawnErrors < 5) {
            moreupEliteSpawnErrors++
            console.error(`[MoreUp] 정예 판정 실패 (${moreupEliteSpawnErrors}/5): ${e}`)
        }
    }
})

console.info('[MoreUp] 정예 몬스터 판정 등록')
