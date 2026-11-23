// More Up: 설계도 대포 빠르게 (2026-11-14 사용자 요청 "대포 속도 개빠르게 0.1 정도?")
// Create 6.0.8 설정 schematicannonDelay 는 정수(최소 1)이고, 한 발 쏜 뒤 (값+1)번 틱이 지나야 다음 발이다
// (SchematicannonBlockEntity.tickPrinter: printerCooldown > 0 이면 1 줄이고 끝, 쏘면 printerCooldown = 설정값. jar 디스어셈블로 확인)
// → 설정을 1 로 해도 2틱에 1발(초당 10블록)이 한계라, 대포를 한 틱에 여러 번 돌린다
//  - 서버 틱마다 MOREUP_CANNON_SHOTS 번: 대기(printerCooldown)를 0 으로 지우고 대포의 tick() 을 한 번 더 부른다
//    = 대포 한 대가 한 틱에 약 MOREUP_CANNON_SHOTS 발 (10 이면 0.1틱에 1발, 초당 약 200블록)
//  - 화약·재료 소모, 재료 없으면 멈춤, 일시정지, 범위 검사, 날아가는 블록은 모두 Create 동작 그대로 (tick() 전체를 부르므로 날아가는 시간도 같이 빨라진다)
//  - 대상: 플레이어가 우클릭(화면 열기)한 대포. 목록은 server.persistentData 에 저장해 재시작·/reload 뒤에도 남는다
//  - 청크가 로드된 대포만 (언로드 청크를 불러오지 않는다), 상태가 RUNNING 일 때만. 대포가 없어진 자리는 목록에서 뺀다
//  - 오류가 나면 그 대포만 목록에서 빼고 로그를 남긴다 (서버는 계속)
const MOREUP_CANNON_SHOTS = 10          // 틱당 추가로 돌리는 횟수 (= 틱당 발 수). 서버가 버거우면 줄인다
const MOREUP_CANNON_MAX = 32            // 목록 최대 개수 (오래된 것부터 밀려남)
const MOREUP_CANNON_KEY = 'moreupFastCannons'

const $MoreUpCannonBE = Java.loadClass('com.simibubi.create.content.schematics.cannon.SchematicannonBlockEntity')
const $MoreUpCannonBlockPos = Java.loadClass('net.minecraft.core.BlockPos')
let moreupCannonList = null             // [{dim, x, y, z}]  null = 아직 안 불러옴
let moreupCannonRefl = null

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

ServerEvents.tick(event => {
    let server = event.server
    if (moreupCannonList == null) moreupCannonLoad(server)
    if (moreupCannonList.length === 0) return
    let changed = false
    for (let i = moreupCannonList.length - 1; i >= 0; i--) {
        let c = moreupCannonList[i]
        try {
            let level = server.getLevel(c.dim)
            if (level == null) { moreupCannonList.splice(i, 1); changed = true; continue }
            let pos = new $MoreUpCannonBlockPos(c.x, c.y, c.z)
            if (!level.isLoaded(pos)) continue                  // 청크가 없으면 건너뛴다 (불러오지 않음)
            let be = level.getBlockEntity(pos)
            if (!(be instanceof $MoreUpCannonBE)) { moreupCannonList.splice(i, 1); changed = true; continue }
            let r = moreupCannonReflect()
            for (let n = 0; n < MOREUP_CANNON_SHOTS; n++) {
                if (String(r.state.get(be)) !== 'RUNNING' || be.isRemoved()) break
                r.cooldown.setInt(be, 0)
                be.tick()
            }
        } catch (e) {
            console.error(`[MoreUp] 빠른 설계도 대포 처리 실패, 목록에서 뺌 (${c.dim} ${c.x} ${c.y} ${c.z}): ${e}`)
            moreupCannonList.splice(i, 1)
            changed = true
        }
    }
    if (changed) moreupCannonSave(server)
})
