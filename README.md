# Demo AWS Amplify Gen 2: REST API, Auth, SQS

Luồng: React → Cognito login → API Gateway xác thực access token → Lambda REST → DynamoDB và SQS → Lambda worker cập nhật kết quả.

## Chạy demo

Yêu cầu Node.js và AWS credentials có quyền tạo tài nguyên Amplify, API Gateway, Cognito, Lambda, DynamoDB, SQS.

```bash
npm install
npx ampx sandbox
```

Sau khi sandbox tạo `amplify_outputs.json`, mở terminal khác:

```bash
npm run dev
```

Mở http://localhost:5173, đăng ký bằng email, nhập mã xác nhận, đăng nhập, tạo task. Task trả về `QUEUED` (HTTP 202), sau đó Lambda SQS đổi thành `DONE` và trả văn bản chữ hoa. Giao diện làm mới mỗi 3 giây.

## REST API

Mọi route dùng Cognito access token trong `Authorization: Bearer <token>`.

| Route              | Quyền                 | Ý nghĩa                                 |
| ------------------ | --------------------- | --------------------------------------- |
| `GET /me`          | đã đăng nhập          | thông tin người dùng, quyền admin       |
| `POST /tasks`      | đã đăng nhập          | tạo task với JSON `{"text":"xin chao"}` |
| `GET /tasks`       | đã đăng nhập          | tối đa 100 task của mình                |
| `GET /tasks/{id}`  | chủ sở hữu hoặc admin | xem một task                            |
| `GET /admin/tasks` | nhóm `ADMINS`         | tối đa 100 task của mọi người           |

Ví dụ gọi API sau khi đăng nhập, lấy access token từ `fetchAuthSession()`:

```bash
curl -H "Authorization: Bearer $TOKEN" "$API_URL/me"
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"text":"xin chao"}' "$API_URL/tasks"
```

`API_URL` nằm ở `amplify_outputs.json` → `custom.API.tasks.endpoint`. Người dùng thường gọi `/admin/tasks` nhận 403; xem task của người khác nhận 404.

Để tạo admin cho demo, sau khi người dùng đăng ký, dùng AWS CLI với user pool ID trong `amplify_outputs.json`:

```bash
aws cognito-idp admin-add-user-to-group --user-pool-id YOUR_USER_POOL_ID --username USER_EMAIL --group-name ADMINS
```

Đăng xuất và đăng nhập lại để nhận claim nhóm mới trong access token. SQS thử lại task lỗi tối đa 3 lần rồi chuyển vào dead letter queue. `npx ampx sandbox delete` xóa tài nguyên sandbox khi xong.

Ghi chú demo: danh sách dùng DynamoDB Scan giới hạn 100 bản ghi, phù hợp dữ liệu nhỏ. Khi cần tải lớn, thêm index theo `owner` và phân trang. CORS hiện cho phép `http://localhost:5173`; khi đưa giao diện lên Amplify Hosting, thêm domain frontend vào `allowOrigins` trong `amplify/backend.ts`.

# Demo_Amplify
