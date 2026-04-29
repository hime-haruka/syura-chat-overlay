# Syura CHZZK Chat Overlay

원본 StreamElements 챗박스처럼 `main-container → message-row → namebox → badgescont → msgcont → messagebox` 구조로 채팅을 렌더링하는 치지직용 오버레이 서버입니다.

## 1. GitHub에 올릴 파일

이 폴더 전체를 GitHub에 올립니다.

```txt
server.js
package.json
render.yaml
public/overlay/index.html
public/overlay/style.css
public/overlay/overlay.js
config/default-style.json
config/pop.json
receiver/receiver.js
receiver/.env.example
.env.example
.gitignore
README.md
```

절대 올리지 말 것:

```txt
.env
private/
private/tokens.json
receiver/config.local.json
Receiver.exe
CHZZK_CLIENT_SECRET 실제값
CHZZK_ACCESS_TOKEN 실제값
```

## 2. Render 설정

Render New Web Service에서 아래처럼 설정합니다.

```txt
Language: Node
Branch: main
Root Directory: 비워두기
Build Command: npm install
Start Command: npm start
```

Environment Variables:

```env
PORT=10000
PUBLIC_BASE_URL=https://syura-chat-overlay.onrender.com
INGEST_KEY=긴_랜덤_문자
CHZZK_CLIENT_ID=치지직_개발자센터_Client_ID
CHZZK_CLIENT_SECRET=치지직_개발자센터_Client_Secret
CHZZK_REDIRECT_URI=https://syura-chat-overlay.onrender.com/auth/chzzk/callback
```

`CLIENT_ID=pop` 같은 값은 Render 환경변수에 넣지 않습니다. `pop`은 URL과 설정 파일로 분기합니다.

## 3. 치지직 개발자센터 설정

앱의 로그인 리디렉션 URL에 아래 값을 등록합니다.

```txt
https://syura-chat-overlay.onrender.com/auth/chzzk/callback
```

Render의 `CHZZK_REDIRECT_URI`와 개발자센터 Redirect URI는 글자 하나까지 같아야 합니다.

필요 Scope는 최소 `채팅 메시지 조회`입니다.

## 4. 배포 후 테스트

배포 후 접속 확인:

```txt
https://syura-chat-overlay.onrender.com/health
```

OBS 주소:

```txt
https://syura-chat-overlay.onrender.com/chat/pop
```

## 5. 치지직 인증 및 세션 시작

브라우저에서 아래 주소를 엽니다.

```txt
https://syura-chat-overlay.onrender.com/auth/chzzk/start?clientId=pop
```

치지직 인증이 끝나면 서버의 `private/tokens.json`에 pop 토큰이 저장됩니다. 이 파일은 GitHub에 올라가면 안 됩니다.

그 다음 세션 시작:

```bash
curl -X POST "https://syura-chat-overlay.onrender.com/admin/chzzk/start/pop?key=INGEST_KEY값"
```

상태 확인:

```bash
curl "https://syura-chat-overlay.onrender.com/admin/chzzk/status/pop?key=INGEST_KEY값"
```

## 6. 클라이언트 추가 방법

새 클라이언트가 생기면 `config/클라이언트ID.json`을 추가합니다.

```txt
config/pop.json
config/clientA.json
config/clientB.json
```

OBS 주소는 자동으로 분기됩니다.

```txt
https://syura-chat-overlay.onrender.com/chat/pop
https://syura-chat-overlay.onrender.com/chat/clientA
https://syura-chat-overlay.onrender.com/chat/clientB
```

Render 서버는 하나만 씁니다.

## 7. 로컬 Receiver 테스트

서버만 테스트하고 싶을 때:

```bash
npm install
npm run dev
```

다른 터미널:

```bash
cp receiver/.env.example receiver/.env
npm run receiver:test
```

로컬 OBS 주소:

```txt
http://localhost:8080/chat/pop
```

## 8. 주의

Render 무료 플랜은 미사용 시 슬립이 있을 수 있습니다. 실제 판매/방송용은 유료 플랜 또는 항상 켜져 있는 서버를 권장합니다.
