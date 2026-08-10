# CookCoach

CookCoach는 냉장고와 영수증에서 확인한 재료를 바탕으로 메뉴 선택부터 실제 조리 중 문제 해결, 식사 기록까지 돕는 모바일 우선 웹 앱 프로토타입이다.

현재 개발 기준 파일은 기존 `CookCoach_6.html`에서 복제한 `index.html`이다. 원본은 `legacy/CookCoach_6.original.html`에 보존한다. Vanilla HTML/CSS/JavaScript를 유지하며 Netlify 정적 배포를 목표로 한다.

프로젝트의 Source of Truth는 `docs/index.md`에서 시작한다. 구현 작업 전 관련 문서를 먼저 확인한다.

## 현재 범위

- 기존 프로토타입과 Vanilla HTML/CSS/JavaScript 구조 보존
- 냉장고 → 영수증 순차 SCAN과 카메라·사진 선택 fallback
- 규동 Golden Path, 필수 재료 판정, 6단계 COACH와 STEP별 도움말
- 재료·식사 기록·프로필·건강 목표의 브라우저 로컬 저장
- 날짜별 실제 식사 기록과 최근 상대 날짜 데모 캘린더

## 실행

정적 파일 서버의 루트로 이 디렉터리를 열고 `index.html`에 접속한다. 카메라 기능은 브라우저 권한과 보안 컨텍스트(HTTPS 또는 localhost)가 필요하다.

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 연다. `index.html`을 `file://` 주소로 직접 열면 브라우저 보안 정책 때문에 카메라가 차단될 수 있다.

카메라가 열리지 않으면 주소창의 카메라 권한, 다른 앱의 카메라 점유 여부, 연결된 카메라 장치를 확인한다. 개발자 도구 콘솔에는 `getUserMedia` 오류의 `name`, `message`, secure context 여부가 기록된다. 카메라를 사용할 수 없는 경우에도 사진 선택 또는 건너뛰기로 SCAN을 계속할 수 있다.
