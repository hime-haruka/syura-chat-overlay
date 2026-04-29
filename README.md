# Syura CHZZK Chat Overlay — 서버 로그인 방식

이 버전은 **Receiver.exe를 사용하지 않습니다.**

클라이언트 사용 흐름은 아래처럼 단순합니다.

```txt
관리자 페이지에서 치지직 로그인
↓
관리자 페이지에서 세션 시작
↓
OBS에 /chat/:clientId 주소 추가
```

## 1. GitHub에 올리는 파일

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
.env.example
.gitignore
README.md
```

GitHub에 올리면 안 되는 것:

```txt
.env
private/tokens.json
CHZZK_CLIENT_SECRET 실제값
Access Token / Refresh Token
```

## 2. Render 설정

Render에서 New Web Service를 만들고 GitHub 레포를 연결합니다.

```txt
Language: Node
Branch: main
Root Directory: 비워두기
Build Command: npm install
Start Command: npm start
```

Environment Variables에는 아래처럼 넣습니다.

```env
PORT=10000
PUBLIC_BASE_URL=https://syura-chat-overlay.onrender.com
CHZZK_CLIENT_ID=치지직_개발자센터_Client_ID
CHZZK_CLIENT_SECRET=치지직_개발자센터_Client_Secret
CHZZK_REDIRECT_URI=https://syura-chat-overlay.onrender.com/auth/chzzk/callback
ADMIN_KEY=긴_랜덤_관리자키
```

`CLIENT_ID=pop`은 넣지 않습니다. `clientId`는 URL에서 분기됩니다.

## 3. 치지직 개발자센터 설정

앱의 로그인 리디렉션 URL을 Render 환경변수와 완전히 같게 등록합니다.

```txt
https://syura-chat-overlay.onrender.com/auth/chzzk/callback
```

필요 Scope:

```txt
채팅 메시지 조회
```

후원/구독 이벤트도 같이 쓸 예정이면 아래 Scope도 추가합니다.

```txt
후원 조회
구독 조회
```

## 4. 관리자 페이지

`pop` 클라이언트용 관리자 페이지:

```txt
https://syura-chat-overlay.onrender.com/admin/pop
```

순서:

```txt
1. 치지직 로그인/인증 클릭
2. 인증 완료 후 다시 /admin/pop으로 이동
3. ADMIN_KEY 입력 후 저장
4. 세션 시작 클릭
5. 테스트 메시지 클릭해서 OBS에 뜨는지 확인
```

## 5. OBS 주소

```txt
https://syura-chat-overlay.onrender.com/chat/pop
```

다른 클라이언트는 URL과 설정 파일만 추가하면 됩니다.

```txt
/admin/clientA
/chat/clientA
config/clientA.json
```

## 6. 클라이언트에게 전달할 내용

클라이언트에게는 EXE를 주지 않습니다.

```txt
관리자 페이지: https://syura-chat-overlay.onrender.com/admin/pop
OBS 주소: https://syura-chat-overlay.onrender.com/chat/pop
```

API Secret, `.env`, 토큰 파일은 절대 전달하지 않습니다.

## 7. 로컬 테스트

```bash
npm install
cp .env.example .env
npm run dev
```

로컬 주소:

```txt
http://localhost:8080/admin/pop
http://localhost:8080/chat/pop
```

로컬로 OAuth를 테스트하려면 치지직 개발자센터 Redirect URI도 로컬 주소로 등록되어 있어야 합니다.
