// More Up: 설계도 대포 빠르게
//  - 2026-11-14 사용자 요청 "대포 속도 개빠르게 0.1 정도?" → 틱당 10발 고정 (1.14.3)
//  - 2026-11-26 사용자 요청 "렉이 걸리기 직전까지 최고속도" → 고정 횟수 대신 "서버가 남는 시간만큼" 쏜다
// Create 6.0.8 설정 schematicannonDelay 는 정수(최소 1)이고, 한 발 쏜 뒤 (값+1)번 틱이 지나야 다음 발이다
// (SchematicannonBlockEntity.tickPrinter: printerCooldown > 0 이면 1 줄이고 끝, 쏘면 printerCooldown = 설정값. jar 디스어셈블로 확인)
// → 설정을 1 로 해도 2틱에 1발(초당 10블록)이 한계라, 대포를 한 틱에 여러 번 돌린다
//  - 서버 틱마다: 대기(printerCooldown)를 0 으로 지우고 대포의 tick() 을 한 번 더 부르기를 되풀이한다 (한 번 = 약 1발)
//  - 얼마나 되풀이하나 (2026-11-26):
//      ① 시간 예산: 모든 빠른 대포를 합쳐 한 틱에 MOREUP_CANNON_BUDGET_MS 까지만 쓴다 (마인크래프트 한 틱 = 50ms)
//      ② 렉 감시: 서버 틱 간격 평균이 MOREUP_CANNON_LAG_MS 를 넘으면(= 20 TPS 를 못 지키면) 예산을 줄이고, 돌아오면 다시 늘린다
//         → 서버가 한가하면 최대로, 다른 일로 바쁘면 알아서 느려져 TPS 를 지킨다
//      ③ 안전 상한: 대포 한 대 한 틱 MOREUP_CANNON_SHOTS_MAX 번, 전체 MOREUP_CANNON_TOTAL_MAX 번
//      대포가 여러 대면 매 틱 시작 대포를 돌려가며 고르게 나눈다
//  - 화약·재료 소모, 재료 없으면 멈춤, 일시정지, 범위 검사, 날아가는 블록은 모두 Create 동작 그대로 (tick() 전체를 부르므로 날아가는 시간도 같이 빨라진다)
//  - 블록 변경·대포 상태 전송은 마인크래프트가 틱마다 모아서 보내므로 발 수가 늘어도 패킷 수는 틱당 한 번 수준
//  - 대상: 플레이어가 우클릭(화면 열기)한 대포. 목록은 server.persistentData 에 저장해 재시작·/reload 뒤에도 남는다
//  - 청크가 로드된 대포만 (언로드 청크를 불러오지 않는다), 상태가 RUNNING 일 때만. 대포가 없어진 자리는 목록에서 뺀다
//  - 오류가 나면 그 대포만 목록에서 빼고 로그를 남긴다 (서버는 계속)
//  - 작동 중이면 1분마다 서버 로그에 "[MoreUp] 빠른 설계도 대포: 지난 1분 …" 한 줄 (발 수·예산 비율·틱 간격) → 조정할 때 본다
const MOREUP_CANNON_BUDGET_MS = 20      // 한 틱에 모든 빠른 대포가 함께 쓸 수 있는 최대 시간(ms). 렉이 느껴지면 줄인다
const MOREUP_CANNON_LAG_MS = 52         // 틱 간격 평균이 이보다 길면 서버가 밀리는 것으로 보고 예산을 줄인다 (정상 50)
const MOREUP_CANNON_SHOTS_MAX = 200     // 대포 한 대가 한 틱에 더 돌 수 있는 최대 횟수 (안전 상한, 초당 약 4,000블록)
const MOREUP_CANNON_TOTAL_MAX = 400     // 모든 대포 합계 한 틱 최대 횟수 (안전 상한)
const MOREUP_CANNON_MAX = 32            // 목록 최대 개수 (오래된 것부터 밀려남)
const MOREUP_CANNON_KEY = 'moreupFastCannons'

const $MoreUpCannonBE = Java.loadClass('com.simibubi.create.content.schematics.cannon.SchematicannonBlockEntity')
const $MoreUpCannonBlockPos = Java.loadClass('net.minecraft.core.BlockPos')
let moreupCannonList = null             // [{dim, x, y, z}]  null = 아직 안 불러옴
let moreupCannonRefl = null

// 시간: 가능하면 나노초 시계(정밀), 안 되면 Date.now() (Windows 에서는 거칠 수 있어 안전 상한이 같이 막는다)
let moreupCannonNanoClock = null
try {
    moreupCannonNanoClock = Java.loadClass('java.lang.System')
    moreupCannonNanoClock.nanoTime()
} catch (e) {
    moreupCannonNanoClock = null
    console.info('[MoreUp] 빠른 설계도 대포: 나노초 시계를 못 써서 Date.now() 로 잰다')
}
function moreupCannonNowMs() {
    if (moreupCannonNanoClock != null) return Number(moreupCannonNanoClock.nanoTime()) / 1000000
    return Date.now()
}

let moreupCannonLastTick = 0            // 지난 틱 시각 (Date.now, 틱 간격용)
let moreupCannonAvgGap = 50             // 틱 간격 평균(ms)
let moreupCannonScale = 1               // 예산 비율 0.05 ~ 1
let moreupCannonStart = 0               // 이번 틱에 먼저 돌 대포 번호 (돌려가며)
let moreupCannonStat = { shots: 0, ticks: 0, scaleSum: 0, gapMax: 0, since: 0 }

function moreupCannonReflect() {
    if (moreupCannonRefl == null) {
        let cls = $MoreUpCannonBE.__javaObject__
        let cooldown = cls.getDeclaredField('printerCooldown')
        cooldown.setAccessible(true)
        moreupCannonRefl = { cooldown: cooldown, state: cls.getField('state') }
    }
    return moreupCannonRefl
}

function moreupCannonLoad(server) {
    try {
        let raw = String(server.persistentData.getString(MOREUP_CANNON_KEY))
        moreupCannonList = raw ? JSON.parse(raw) : []
    } catch (e) {
        console.error('[MoreUp] 빠른 설계도 대포 목록 불러오기 실패, 비움: ' + e)
        moreupCannonList = []
    }
}

function moreupCannonSave(server) {
    server.persistentData.putString(MOREUP_CANNON_KEY, JSON.stringify(moreupCannonList))
}

// 대포 등록 (우클릭 때, 시험 스크립트도 이걸 부른다)
global.moreupCannonRegister = (server, dim, x, y, z) => {
    if (moreupCannonList == null) moreupCannonLoad(server)
    dim = String(dim)
    for (let c of moreupCannonList) if (c.dim === dim && c.x === x && c.y === y && c.z === z) return false
    moreupCannonList.push({ dim: dim, x: x, y: y, z: z })
    while (moreupCannonList.length > MOREUP_CANNON_MAX) moreupCannonList.shift()
    moreupCannonSave(server)
    return true
}

BlockEvents.rightClicked('create:schematicannon', event => {
    try {
        let b = event.block
        global.moreupCannonRegister(event.server, event.level.dimension, b.x, b.y, b.z)
    } catch (e) {
        console.error('[MoreUp] 빠른 설계도 대포 등록 실패: ' + e)
    }
})

// 렉 감시: 틱 간격 평균으로 예산 비율을 정한다
function moreupCannonWatchLag() {
    let now = Date.now()
    if (moreupCannonLastTick > 0) {
        let gap = now - moreupCannonLastTick
        if (gap > 0 && gap < 2000) {                         // 저장·/reload 같은 한 번의 긴 멈춤(2초 이상)은 빼고 본다
            moreupCannonAvgGap = moreupCannonAvgGap * 0.9 + gap * 0.1
            if (gap > moreupCannonStat.gapMax) moreupCannonStat.gapMax = gap
        }
    }
    moreupCannonLastTick = now
    if (moreupCannonAvgGap > MOREUP_CANNON_LAG_MS) moreupCannonScale = Math.max(0.05, moreupCannonScale * 0.85)
    else moreupCannonScale = Math.min(1, moreupCannonScale + 0.02)
}

function moreupCannonReport() {
    let s = moreupCannonStat
    let now = Date.now()
    if (s.since === 0) { s.since = now; return }
    if (now - s.since < 60000) return
    if (s.shots > 0) {
        console.info(`[MoreUp] 빠른 설계도 대포: 지난 1분 추가 ${s.shots}발 (작동 틱 평균 ${(s.shots / Math.max(1, s.ticks)).toFixed(1)}발/틱), 예산 비율 평균 ${(s.scaleSum / Math.max(1, s.ticks)).toFixed(2)}, 틱 간격 평균 ${moreupCannonAvgGap.toFixed(1)}ms 최대 ${s.gapMax}ms`)
    }
    moreupCannonStat = { shots: 0, ticks: 0, scaleSum: 0, gapMax: 0, since: now }
}

ServerEvents.tick(event => {
    // tick 핸들러 예외는 같은 틱의 다른 스크립트까지 멈추므로 전체를 잡는다
    try {
        let server = event.server
        moreupCannonWatchLag()
        if (moreupCannonList == null) moreupCannonLoad(server)
        let count = moreupCannonList.length
        if (count === 0) return
        let budget = MOREUP_CANNON_BUDGET_MS * moreupCannonScale
        let t0 = moreupCannonNowMs()
        let total = 0
        let changed = false
        let dead = {}                                        // 목록에서 뺄 번호
        let r = moreupCannonReflect()
        let start = moreupCannonStart % count
        moreupCannonStart = (start + 1) % count
        for (let k = 0; k < count; k++) {
            if (total >= MOREUP_CANNON_TOTAL_MAX || moreupCannonNowMs() - t0 >= budget) break
            let i = (start + k) % count
            let c = moreupCannonList[i]
            try {
                let level = server.getLevel(c.dim)
                if (level == null) { dead[i] = true; continue }
                let pos = new $MoreUpCannonBlockPos(c.x, c.y, c.z)
                if (!level.isLoaded(pos)) continue                  // 청크가 없으면 건너뛴다 (불러오지 않음)
                let be = level.getBlockEntity(pos)
                if (!(be instanceof $MoreUpCannonBE)) { dead[i] = true; continue }
                for (let n = 0; n < MOREUP_CANNON_SHOTS_MAX; n++) {
                    if (String(r.state.get(be)) !== 'RUNNING' || be.isRemoved()) break
                    r.cooldown.setInt(be, 0)
                    be.tick()
                    total++
                    if (total >= MOREUP_CANNON_TOTAL_MAX) break
                    if ((n & 3) === 3 && moreupCannonNowMs() - t0 >= budget) break   // 시계는 4번에 한 번 본다
                }
            } catch (e) {
                console.error(`[MoreUp] 빠른 설계도 대포 처리 실패, 목록에서 뺌 (${c.dim} ${c.x} ${c.y} ${c.z}): ${e}`)
                dead[i] = true
            }
        }
        for (let i = count - 1; i >= 0; i--) if (dead[i]) { moreupCannonList.splice(i, 1); changed = true }
        if (changed) moreupCannonSave(server)
        if (total > 0) {
            moreupCannonStat.shots += total
            moreupCannonStat.ticks++
            moreupCannonStat.scaleSum += moreupCannonScale
        }
        moreupCannonReport()
    } catch (e) {
        console.error('[MoreUp] 빠른 설계도 대포 틱 처리 실패: ' + e)
    }
})
