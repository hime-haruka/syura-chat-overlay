# CHZZK Client Chat Overlay

원본 StreamElements 챗박스처럼 `main-container -> message-row -> namebox/badgescont/msgcont/messagebox/message` 구조로 채팅을 렌더링하는 치지직용 오버레이입니다.

## 1. 설치

```bash
npm install
cp .env.example .env
```

`.env`에서 최소 수정:

```env
PORT=8080
INGEST_KEY=아무도모르는긴랜덤키
CLIENT_ID=client_a
PUBLIC_BASE_URL=http://localhost:8080
TEST_MODE=true
```

## 2. 로컬 테스트

터미널 1:

```bash
npm run dev
```

터미널 2:

```bash
npm run receiver:test
```

브라우저/OBS 주소:

```txt
http://localhost:8080/chat/client_a
```

## 3. 치지직 연결

`.env`에서:

```env
TEST_MODE=false
CHZZK_USER_HASH=치지직_채널_해시값
```

실행:

```bash
npm run receiver
```

이 프로젝트는 `@d2n0s4ur/chzzk-chat` 비공식 채팅 라이브러리를 사용합니다. 라이브러리 버전에 따라 connect/start 메서드명이 바뀌면 `receiver/receiver.js`의 `startChzzk()` 부분만 맞춰주면 됩니다.

## 4. 클라이언트 제공 방식

클라이언트에게는 아래 두 개만 제공합니다.

1. Receiver.exe 또는 압축된 receiver 실행 파일
2. OBS 브라우저 소스 URL

```txt
https://your-domain.com/chat/client_a
```

클라이언트에게 절대 제공하지 말 것:

- `INGEST_KEY`
- 서버 `.env`
- 치지직 인증 쿠키/토큰
- 서버 소스 코드

## 5. 디자인 수정

기본 스타일은 `config/default-style.json`을 읽습니다.
클라이언트별 스타일은 아래처럼 파일을 추가합니다.

```txt
config/client_a.json
config/client_b.json
```

OBS 주소의 client 값과 파일명이 매칭됩니다.

```txt
/chat/client_a -> config/client_a.json
```

## 6. 서버 배포

### Render / VPS 공통

```bash
npm install
npm run start
```

환경변수:

```env
PORT=8080
INGEST_KEY=긴랜덤키
CLIENT_ID=client_a
```

OBS에는:

```txt
https://도메인/chat/client_a
```

Receiver에는:

```env
OVERLAY_SERVER_WS=wss://도메인/receiver
CLIENT_ID=client_a
INGEST_KEY=서버와_같은_긴랜덤키
```

## 7. EXE 패키징

Receiver만 EXE로 묶는 것을 권장합니다.

```bash
npm install -g pkg
pkg receiver/receiver.js --targets node20-win-x64 --output Receiver.exe
```

실제 배포 시에는 `.env`를 Receiver.exe와 같은 폴더에 두거나, 별도 설정 UI를 붙여서 CLIENT_ID / 서버 주소만 입력하게 만드세요.
