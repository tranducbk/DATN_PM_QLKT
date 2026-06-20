# Kịch bản thuyết trình — Bảo vệ ĐATN "Phần mềm Quản lý Khen thưởng"

> Lời văn để **nói**, bám sát **33 slide** trong `Slide.pptx`. Không đọc nguyên văn bullet trên slide — slide là chỗ dựa, lời nói mới là phần chính.

## Hướng dẫn dùng

| Mục | Chi tiết |
|---|---|
| **Tổng thời lượng** | ~14–15 phút (chừa Q&A) |
| **Nhịp đọc** | 130–140 từ/phút, chậm rãi, ngắt câu rõ |
| **Xưng hô** | "Em" / "Hội đồng" (hoặc "thầy/cô"). Trang trọng — không "tôi", không "các bạn" |
| **Số liệu** | Đọc dạng chữ: "hai mươi ba bảng", "bốn mươi bảy khoá ngoại" |
| **Nhóm ERD (slide 15–21)** | Lướt nhanh, mỗi slide ~1 câu; dồn thời gian cho chuỗi danh hiệu và phần đóng góp |

**Ký hiệu trong kịch bản:** `[ngừng]` dừng ~1 giây · `[nhấn]` đọc to/chậm hơn · `[chỉ slide]` quay xuống chỉ vào slide rồi nhìn lại Hội đồng.

## Cách đọc thuật ngữ

| Trên slide | Đọc khi nói |
|---|---|
| `Next.js` / `Node.js` | "Nếch jés" / "Nốt jés" |
| `Express` / `Prisma` | "Ếch-prét" / "Prít-mà" |
| `PostgreSQL` | "Pót-grét" (hoặc "Pót-grét quây-eo") |
| `TypeScript` / `Socket.IO` | "Tai-scríp" / "Sốc-két ai-ô" |
| `JWT` / `PM2` / `ORM` | "Jót" / "Pi-em-hai" / "Ô-e-em" |
| `Strategy` / `Registry` | giữ nguyên, hoặc "mẫu chiến lược" / "bảng đăng ký" |
| **BKBQP / CSTĐTQ / BKTTCP** | Đọc **đầy đủ**: "Bằng khen của Bộ trưởng Bộ Quốc phòng" / "Chiến sĩ thi đua toàn quân" / "Bằng khen của Thủ tướng Chính phủ" — **không** đọc viết tắt |
| **CSTĐCS / ĐVQT** | "Chiến sĩ thi đua cơ sở" / "Đơn vị quyết thắng" |
| **HCBVTQ / HCCSVV / HCQKQT / KNC** | "Huân chương Bảo vệ Tổ quốc" / "Huy chương Chiến sĩ vẻ vang" / "Huy chương Quân kỳ quyết thắng" / "Kỷ niệm chương Vì sự nghiệp xây dựng Quân đội" |
| **NCKH** | "nghiên cứu khoa học" |

---

## Slide 1 — Trang bìa (~35 giây)

**[Mở]**: *(Đứng thẳng, cúi nhẹ chào Hội đồng ~1 giây.)*

**[Lời văn]**:

> Em kính chào các thầy, cô trong Hội đồng. [ngừng]
>
> Em là **Trần Anh Đức**, mã số sinh viên 20220120, Trường Công nghệ Thông tin và Truyền thông, Đại học Bách khoa Hà Nội.
>
> Hôm nay em xin trình bày đồ án tốt nghiệp với đề tài [nhấn] **"Phần mềm Quản lý Khen thưởng tại Học viện Khoa học Quân sự"**, thực hiện dưới sự hướng dẫn của thầy **Thạc sĩ Lê Đức Trung**. Em xin gửi lời cảm ơn chân thành đến thầy đã tận tình hướng dẫn em trong suốt quá trình làm đồ án.
>
> Em xin phép được bắt đầu ạ.

**[Chuyển]**: *Đầu tiên, em xin giới thiệu nội dung bài trình bày.*

---

## Slide 2 — Nội dung trình bày (~20 giây)

**[Lời văn]**:

> Bài trình bày của em gồm bốn phần. **Phần một** — Mở đầu: mục tiêu, hệ thống khen thưởng và đặc biệt là logic chuỗi danh hiệu, phần nghiệp vụ phức tạp nhất. **Phần hai** — Công nghệ và thiết kế hệ thống. **Phần ba** — bốn đóng góp nổi bật. Và **phần bốn** — kiểm thử, triển khai cùng kết luận.

**[Chuyển]**: *Em xin vào phần một.*

---

## Slide 3 — Phần I: Mở đầu (~8 giây)

**[Lời văn]**:

> Trong phần mở đầu, em sẽ trình bày mục tiêu đề tài, hệ thống khen thưởng với chuỗi danh hiệu, và phân tích các thách thức của bài toán.

**[Chuyển]**: *Trước hết là bối cảnh và mục tiêu.*

---

## Slide 4 — Mục tiêu của đồ án (~50 giây)

**[Lời văn]**:

> Hiện nay, công tác khen thưởng tại nhiều đơn vị quân đội vẫn chủ yếu dựa trên file Excel và hồ sơ giấy. [ngừng] Cách làm này bộc lộ ba hạn chế. Một là khó tra cứu lịch sử khen thưởng qua nhiều năm và dễ bỏ sót. Hai là các quy định chuỗi danh hiệu rất phức tạp, tính tay dễ sai. Ba là dữ liệu phân tán, không lưu vết được ai sửa, ai xoá.
>
> Từ đó, đồ án đặt bốn mục tiêu: [chỉ slide] quản lý đầy đủ [nhấn] **bảy nhóm khen thưởng** với bốn cấp vai trò; **tự động hoá** việc xét điều kiện theo quy định; hỗ trợ trọn quy trình **đề xuất — gắn quyết định — phê duyệt** có truy vết; và vận hành được hoàn toàn **trong mạng nội bộ**, không phụ thuộc Internet — đây là yêu cầu bảo mật đặc thù của quân đội.

**[Chuyển]**: *Cụ thể, hệ thống khen thưởng gồm những nhóm nào, em xin trình bày tiếp.*

---

## Slide 5 — Hệ thống khen thưởng (~45 giây)

**[Lời văn]**:

> Toàn bộ được chia thành các nhóm. [chỉ slide] **Hằng năm** gồm khen thưởng cá nhân và đơn vị, xét theo từng năm. **Niên hạn** xét theo số năm phục vụ, như Huy chương Chiến sĩ vẻ vang, Huy chương Quân kỳ quyết thắng, Kỷ niệm chương. **Cống hiến** là Huân chương Bảo vệ Tổ quốc, xét theo số tháng giữ chức vụ. **Thành tích** là nghiên cứu khoa học. Và **đột xuất** theo sự kiện, chiến công.
>
> Bốn nhóm đầu được hiện thực thành **bảy loại đề xuất** và xử lý thống nhất qua mẫu Strategy ở phía máy chủ — phần này em sẽ nói ở cuối. Khen thưởng đột xuất quản lý riêng vì không có quy tắc xét cố định.

**[Chuyển]**: *Phức tạp nhất là chuỗi danh hiệu hằng năm — em xin đi sâu vào đây.*

---

## Slide 6 — Chuỗi danh hiệu cá nhân (~75 giây) ⭐ trọng tâm

**[Lời văn]**:

> Đây là phần nghiệp vụ khó nhất của đồ án. [ngừng] Trên nền tảng là danh hiệu **Chiến sĩ thi đua cơ sở** cùng **nghiên cứu khoa học** liên tục mỗi năm, quân nhân tích luỹ dần lên ba cấp cao hơn.
>
> [chỉ slide] **Bằng khen Bộ Quốc phòng** xét theo chu kỳ **hai năm**. **Chiến sĩ thi đua toàn quân** xét theo chu kỳ **ba năm**, và phải có ít nhất một Bằng khen Bộ Quốc phòng trong **cửa sổ trượt ba năm gần nhất**. Cao nhất là **Bằng khen Thủ tướng Chính phủ**, chu kỳ **bảy năm**, cần đủ **ba** Bằng khen Bộ Quốc phòng và **hai** Chiến sĩ thi đua toàn quân trong bảy năm cuối — và đây là danh hiệu [nhấn] **nhận một lần duy nhất**.
>
> Điểm tinh tế là khái niệm [nhấn] **"cửa sổ trượt"**: chỉ những danh hiệu đạt trong vài năm gần nhất mới được tính, danh hiệu cũ tự rơi ra. Và nếu quân nhân **lỡ đợt** — đến mốc mà không đề nghị — thì chu kỳ vẫn đếm tiếp, chu kỳ sau vẫn được xét, không phải làm lại từ đầu. Chính những quy tắc này khiến không thể xét bằng một phép so sánh đơn giản, mà phải nhìn trên toàn dòng thời gian của từng người.

**[Chuyển]**: *Để Hội đồng dễ hình dung, em xin lấy một ví dụ bảy năm.*

---

## Slide 7 — Minh hoạ chuỗi cá nhân, ví dụ 7 năm (~45 giây) ⭐

**[Lời văn]**:

> [chỉ slide] Giả sử một quân nhân giữ Chiến sĩ thi đua cơ sở và có nghiên cứu khoa học đều đặn suốt bảy năm. [ngừng] Cứ sau mỗi hai năm, người đó đạt một **Bằng khen Bộ Quốc phòng** — tức vào năm hai, năm bốn và năm sáu. Cứ sau mỗi ba năm, đạt một **Chiến sĩ thi đua toàn quân** — vào năm ba và năm sáu. Đến **năm thứ bảy**, đã tích đủ ba Bằng khen Bộ Quốc phòng và hai Chiến sĩ thi đua toàn quân, nên đủ điều kiện nhận [nhấn] **Bằng khen Thủ tướng Chính phủ**.
>
> Đúng quá trình tích luỹ này, phần mềm của em tự động tính ra và gợi ý cho cán bộ.

**[Chuyển]**: *Với cấp đơn vị, chuỗi đơn giản hơn một chút.*

---

## Slide 8 — Chuỗi danh hiệu đơn vị (~30 giây)

**[Lời văn]**:

> Chuỗi đơn vị có nền tảng là **Đơn vị quyết thắng** liên tục, và [nhấn] không yêu cầu nghiên cứu khoa học. Trên đó có hai cấp: **Bằng khen Bộ Quốc phòng** đơn vị theo chu kỳ hai năm, và **Bằng khen Thủ tướng Chính phủ** đơn vị theo chu kỳ bảy năm kèm đủ ba Bằng khen Bộ Quốc phòng.
>
> Khác với cá nhân, chuỗi đơn vị [chỉ slide] **không có cấp Chiến sĩ thi đua toàn quân**, **không cần nghiên cứu khoa học**, và **có thể nhận lặp lại** sau mỗi chu kỳ chứ không giới hạn một lần.

**[Chuyển]**: *Ngoài chuỗi hằng năm, còn có các danh hiệu dài hạn.*

---

## Slide 9 — Các danh hiệu dài hạn (~35 giây)

**[Lời văn]**:

> Nhóm dài hạn gồm hai loại. [chỉ slide] **Niên hạn** xét theo năm phục vụ: Huy chương Chiến sĩ vẻ vang hạng Ba, Nhì, Nhất tương ứng mười, mười lăm, hai mươi năm; Huy chương Quân kỳ quyết thắng cho hai mươi lăm năm; Kỷ niệm chương cho nam hai mươi lăm, nữ hai mươi năm.
>
> Còn **cống hiến** là Huân chương Bảo vệ Tổ quốc, xét theo số tháng giữ chức vụ: tích đủ **một trăm hai mươi tháng** với nam, **tám mươi tháng** với nữ, phân theo từng nhóm hệ số chức vụ — hệ số càng cao thì hạng càng cao.

**[Chuyển]**: *Từ toàn bộ nghiệp vụ trên, em rút ra bốn thách thức cốt lõi.*

---

## Slide 10 — Bốn thách thức cốt lõi (~45 giây)

**[Lời văn]**:

> [chỉ slide] **Thứ nhất**, và là trọng tâm: logic chuỗi danh hiệu nhiều năm với cửa sổ trượt, nhận một lần và lỡ đợt — buộc phải xét trên toàn dòng thời gian. **Thứ hai**, cũng là trọng tâm: mỗi lần duyệt cập nhật nhiều bảng cùng lúc, nên phải bảo đảm tính nhất quán bằng giao dịch và chống tranh chấp khi hai cán bộ duyệt đồng thời. **Thứ ba**, phân quyền theo cây tổ chức với bốn vai trò. **Thứ tư**, vận hành hoàn toàn trong mạng nội bộ, không Internet.
>
> Hai thách thức đầu là phần em đầu tư công sức nhất.

**[Chuyển]**: *Sang phần hai, em trình bày công nghệ và thiết kế giải quyết những thách thức đó.*

---

## Slide 11 — Phần II: Công nghệ & Thiết kế (~8 giây)

**[Lời văn]**:

> Phần hai gồm công nghệ, kiến trúc, thiết kế cơ sở dữ liệu, phân tích chức năng và mẫu thiết kế Strategy.

**[Chuyển]**: *Trước hết là công nghệ.*

---

## Slide 12 — Công nghệ sử dụng (~40 giây)

**[Lời văn]**:

> Về công nghệ, phía giao diện em dùng **Next.js** với **TypeScript**, kết hợp **Ant Design** cho biểu mẫu, bảng và **Tailwind CSS** cho bố cục. [ngừng] Phía máy chủ dùng **Express** trên Node.js, truy cập **PostgreSQL** qua **Prisma**. Xác thực bằng **JSON Web Token** hai lớp gồm access và refresh, mật khẩu băm bằng bcrypt.
>
> Toàn bộ viết bằng TypeScript để kiểm soát kiểu hai phía, và dữ liệu vào đều được kiểm tra bằng **Zod**. Một số thành phần phụ trợ: **Socket.IO** cho thông báo thời gian thực, **PM2** để chạy ổn định, **node-cron** cho sao lưu định kỳ, **ExcelJS** cho nhập–xuất Excel.

**[Chuyển]**: *Các thành phần này ghép lại thành kiến trúc tổng quan như sau.*

---

## Slide 13 — Kiến trúc tổng quan (~35 giây)

**[Lời văn]**:

> [chỉ slide] Trình duyệt tải giao diện từ Frontend, sau đó **gọi thẳng tới Backend** qua REST API và Socket.IO — chứ không đi vòng qua Frontend. Phía Backend tổ chức **phân tầng** rõ ràng: Controller nhận yêu cầu, Service xử lý nghiệp vụ, Repository truy cập dữ liệu qua Prisma, rồi xuống PostgreSQL.
>
> Cách phân tầng này giúp tách bạch trách nhiệm: muốn sửa nghiệp vụ chỉ động vào Service, đổi cách lưu dữ liệu chỉ động vào Repository.

**[Chuyển]**: *Tiếp theo là thiết kế cơ sở dữ liệu.*

---

## Slide 14 — Thiết kế cơ sở dữ liệu (~30 giây)

**[Lời văn]**:

> Cơ sở dữ liệu gồm [nhấn] **hai mươi ba bảng**, **bốn mươi bảy khoá ngoại**, khoá chính dùng định danh kiểu CUID. [ngừng] Một điểm thiết kế đáng chú ý: bảng quyết định liên kết với tám bảng khen thưởng [nhấn] **qua chính số quyết định** chứ không qua mã nội bộ; nhờ vậy khi sửa số quyết định, thay đổi tự lan truyền sang mọi bản ghi liên quan, bảo đảm toàn vẹn ngay ở tầng cơ sở dữ liệu.

**[Chuyển]**: *Toàn bộ được chia thành sáu nhóm trong sơ đồ quan hệ.*

---

## Slide 15 — ERD tổng quan (~15 giây · lướt)

**[Lời văn]**:

> Đây là sơ đồ quan hệ tổng quan: hai mươi ba bảng chia thành sáu nhóm dữ liệu nghiệp vụ. Em xin đi nhanh qua từng nhóm.

**[Chuyển]**: *Nhóm thứ nhất — tổ chức và tài khoản.*

---

## Slide 16 — ERD Tổ chức, Quân nhân, Tài khoản (~15 giây · lướt)

**[Lời văn]**:

> Một cơ quan đơn vị có nhiều đơn vị trực thuộc. Mỗi quân nhân gắn một chức vụ, một đơn vị, và có tối đa một tài khoản. Bảng lịch sử chức vụ lưu các giai đoạn giữ chức, dùng để tính số tháng cống hiến.

**[Chuyển]**: *Nhóm đề xuất.*

---

## Slide 17 — ERD Đề xuất (~15 giây · lướt)

**[Lời văn]**:

> Bảng đề xuất là trung tâm, gắn với đơn vị nộp, người đề xuất và người duyệt. Chi tiết từng loại lưu trong cột JSON và chỉ ghi thành bản ghi khen thưởng chính thức khi được phê duyệt.

**[Chuyển]**: *Nhóm khen thưởng cá nhân.*

---

## Slide 18 — ERD Khen thưởng & hồ sơ cá nhân (~15 giây · lướt)

**[Lời văn]**:

> Một quân nhân có nhiều bản ghi danh hiệu hằng năm, nghiên cứu khoa học, Huy chương Chiến sĩ vẻ vang; và quan hệ một–một với các bảng hồ sơ cống hiến, niên hạn. Mỗi cặp quân nhân và năm là duy nhất.

**[Chuyển]**: *Nhóm khen thưởng đơn vị.*

---

## Slide 19 — ERD Khen thưởng & hồ sơ đơn vị (~12 giây · lướt)

**[Lời văn]**:

> Tương tự cho cấp đơn vị: hai bảng gắn với đơn vị được khen, duy nhất theo cặp đơn vị và năm.

**[Chuyển]**: *Nhóm quyết định.*

---

## Slide 20 — ERD Quyết định (~15 giây · lướt)

**[Lời văn]**:

> Bảng quyết định là tâm điểm: một quyết định gắn với nhiều bản ghi khen thưởng. Khoá ngoại trỏ tới số quyết định, đổi số thì lan truyền và không cho xoá khi vẫn còn bản ghi tham chiếu.

**[Chuyển]**: *Cuối cùng là nhóm hệ thống.*

---

## Slide 21 — ERD Hệ thống (~12 giây · lướt)

**[Lời văn]**:

> Nhóm hệ thống: nhật ký gắn với người thực hiện; thông báo gắn với người nhận và trỏ về nhật ký; bảng cấu hình lưu tham số dạng khoá–giá trị.

**[Chuyển]**: *Về mặt chức năng, hệ thống được phân tích như sau.*

---

## Slide 22 — Phân tích chức năng, Use-case (~30 giây)

**[Lời văn]**:

> Hệ thống có **bốn vai trò**: [chỉ slide] Quản trị hệ thống lo hạ tầng; Cán bộ Phòng Chính trị toàn quyền nghiệp vụ; Chỉ huy đơn vị đề xuất trong phạm vi đơn vị mình; và Người dùng tra cứu hồ sơ cá nhân.
>
> Phân quyền được bảo vệ bằng [nhấn] **hai lớp độc lập**: một lớp kiểm tra vai trò ở đầu vào, và một lớp lọc dữ liệu theo cây đơn vị — vượt được lớp này thì lớp kia vẫn chặn.

**[Chuyển]**: *Trọng tâm vận hành là quy trình duyệt đề xuất.*

---

## Slide 23 — Quy trình duyệt đề xuất (~45 giây)

**[Lời văn]**:

> Quy trình gồm bốn bước. [chỉ slide] **Một** — Chỉ huy đơn vị chọn quân nhân và lập đợt đề xuất. **Hai** — hệ thống tự động kiểm tra điều kiện và cảnh báo nếu trùng. **Ba** — cán bộ nhập số quyết định và đính kèm file PDF đã ký. **Bốn** — phê duyệt.
>
> Điểm quan trọng em muốn nhấn mạnh: [nhấn] **quyết định được nhập và đính kèm trước, rồi mới phê duyệt** — đúng với thực tế nghiệp vụ. Và toàn bộ bước phê duyệt — ghi danh hiệu, đổi trạng thái, tính lại hồ sơ, ghi nhật ký — nằm trong [nhấn] **một giao dịch duy nhất**: nếu có lỗi ở bất kỳ khâu nào thì hoàn tác toàn bộ, không để lại dữ liệu dở dang.

**[Chuyển]**: *Để xử lý bảy loại đề xuất gọn gàng, em dùng mẫu thiết kế Strategy.*

---

## Slide 24 — Kiến trúc Strategy (~40 giây)

**[Lời văn]**:

> Vấn đề là có **bảy loại đề xuất**, mỗi loại có cách dựng dữ liệu, kiểm tra và ghi khác nhau. Nếu viết bằng if–else, code sẽ phình thành một tệp rất dài, khó kiểm thử và bảo trì.
>
> [chỉ slide] Giải pháp là một **giao diện chung**, mỗi loại tách thành một tệp riêng, và điều phối qua một **bảng đăng ký** (Registry). Nhờ đó, khi cần thêm một loại khen thưởng mới, em chỉ phải [nhấn] **viết thêm một tệp và đăng ký một dòng**, không phải sửa lại luồng chính — hệ thống mở rộng rất dễ.

**[Chuyển]**: *Sang phần ba — các đóng góp nổi bật.*

---

## Slide 25 — Phần III: Các đóng góp (~10 giây)

**[Lời văn]**:

> Đây là phần em tâm đắc nhất, gồm bốn đóng góp: tự động xét điều kiện, số hoá quy trình, nhập Excel có giao dịch, và lưu vết kết hợp sao lưu.

**[Chuyển]**: *Đóng góp thứ nhất.*

---

## Slide 26 — Đóng góp 1: Tự động xét điều kiện (~60 giây) ⭐

**[Lời văn]**:

> **Vấn đề**: xét chuỗi danh hiệu thủ công — đếm Bằng khen, kiểm cửa sổ ba năm, bảy năm, đối chiếu nghiên cứu khoa học — vừa tốn thời gian vừa dễ sai và bỏ sót.
>
> **Cách làm**: em mô tả mỗi cấp danh hiệu bằng [nhấn] **một dòng cấu hình** — chu kỳ bao nhiêu năm, cần bao nhiêu danh hiệu cấp dưới, trong cửa sổ nào. Một **hàm thuần** đọc cấu hình đó cùng lịch sử của quân nhân rồi kết luận đủ hay chưa, kèm lý do. [ngừng] Quan trọng là **cùng một bộ quy tắc** này được dùng cho cả lúc tính lại hồ sơ lẫn lúc kiểm tra khi phê duyệt, nên kết quả luôn nhất quán.
>
> **Kết quả**: thời gian xét mỗi quân nhân giảm từ [nhấn] **vài chục phút xuống gần như tức thời**, và phần mềm còn tự gợi ý, bắt được cả những trường hợp lỡ đợt vốn rất dễ bị bỏ sót khi làm tay.

**[Chuyển]**: *Đóng góp thứ hai — số hoá quy trình.*

---

## Slide 27 — Đóng góp 2: Số hoá quy trình & lưu vết (~45 giây)

**[Lời văn]**:

> **Vấn đề**: quy trình giấy nhiều bước kéo dài năm đến mười ngày; khi sửa giữa chừng thì không truy được ai sửa, vì sao.
>
> **Cách làm**: em mô hình hoá đề xuất thành một thực thể có ba trạng thái, và đưa bảy loại khen thưởng về cùng một quy trình. Cán bộ nhập số quyết định, đính kèm PDF rồi phê duyệt trong một giao dịch, sau đó hệ thống mới tính lại hồ sơ và ghi nhật ký.
>
> **Kết quả**: rút một đợt xét xuống còn trong ngày, và truy vết được trọn vòng đời đề xuất — ai làm, lúc nào, vì lý do gì.

**[Chuyển]**: *Đóng góp thứ ba — nhập dữ liệu khối lượng lớn.*

---

## Slide 28 — Đóng góp 3: Nhập Excel có giao dịch (~45 giây)

**[Lời văn]**:

> **Vấn đề**: khi triển khai phải di trú dữ liệu lịch sử rất lớn — khoảng [nhấn] **năm mươi nghìn** bản ghi danh hiệu và **mười lăm nghìn** lịch sử chức vụ. Nhập tay sẽ mất nhiều tháng.
>
> **Cách làm**: nhập theo **hai bước**. Bước **Xem trước** đối chiếu dữ liệu với Zod và quy tắc nghiệp vụ, liệt kê đầy đủ dòng lỗi mà chưa ghi gì. Bước **Xác nhận** mới ghi, và ghi trong một giao dịch — nếu lỗi thì hoàn tác toàn bộ.
>
> **Kết quả**: di trú được khối lượng lớn trong thời gian ngắn, không để lại bản ghi nào dở dang; đồng thời hỗ trợ xuất danh sách ra Excel theo nhiều tiêu chí.

**[Chuyển]**: *Và đóng góp thứ tư — lưu vết và sao lưu.*

---

## Slide 29 — Đóng góp 4: Lưu vết, sao lưu & thông báo (~40 giây)

**[Lời văn]**:

> **Vấn đề**: file dùng chung không lưu vết việc sửa, xoá; việc sao lưu thì phụ thuộc kỷ luật từng người.
>
> **Cách làm**: hệ thống ghi nhật ký [nhấn] **mọi thao tác làm thay đổi dữ liệu** — ai, hành động gì, trên đối tượng nào, từ địa chỉ nào, dữ liệu trước và sau ra sao. Cơ sở dữ liệu được **sao lưu định kỳ tự động**, và mọi sự kiện quan trọng được **thông báo thời gian thực** rồi lưu lại để xem sau.
>
> **Kết quả**: mọi thay đổi đều truy vết được, và luôn có bản sao lưu hằng ngày sẵn sàng khôi phục.

**[Chuyển]**: *Cuối cùng, em xin báo cáo kết quả kiểm thử và triển khai.*

---

## Slide 30 — Phần IV: Đánh giá & Tổng kết (~8 giây)

**[Lời văn]**:

> Phần cuối gồm kiểm thử, triển khai, và kết luận cùng hướng phát triển.

**[Chuyển]**: *Về kiểm thử và triển khai.*

---

## Slide 31 — Kiểm thử và triển khai (~45 giây)

**[Lời văn]**:

> Về **kiểm thử**, em kết hợp hai cách: kiểm thử hộp đen thủ công qua giao diện cho tám nhóm chức năng, và kiểm thử tự động bằng Jest cho phần quy tắc chuỗi danh hiệu — phần lõi và dễ sai nhất. Em cũng kiểm tra tương thích trên năm dòng máy và bốn trình duyệt.
>
> Em tập trung vào các kịch bản trọng yếu: tranh chấp khi hai cán bộ duyệt cùng lúc, điều kiện Bằng khen Thủ tướng trong cửa sổ bảy năm, [nhấn] thử gửi thẳng dữ liệu sai qua API để chắc chắn máy chủ vẫn xét lại và từ chối, và trường hợp lỡ đợt.
>
> Về **triển khai**, hệ thống chạy trên máy chủ Windows Server với Node.js và PostgreSQL, dùng PM2 để chạy ổn định cả Backend và Frontend trong mạng nội bộ.

**[Chuyển]**: *Em xin kết luận.*

---

## Slide 32 — Kết luận và hướng phát triển (~45 giây)

**[Lời văn]**:

> **Đã đạt được**: đồ án hoàn thành quản lý bảy nhóm khen thưởng với bốn vai trò, [nhấn] tự động hoá được phần xét duyệt phức tạp nhất, kiểm thử các kịch bản chính và triển khai được trong mạng nội bộ.
>
> **Hạn chế**: hiện chưa hỗ trợ các danh hiệu cao hơn Bằng khen Thủ tướng, chưa có module thống kê chuyên sâu, đang chạy trên một tiến trình, và quyết định mới ở dạng PDF ký tay.
>
> **Hướng phát triển**: bổ sung ứng dụng di động, module phân tích — báo cáo, tích hợp **ký số** bằng Smart Card hoặc USB token, và mở rộng chạy đa tiến trình khi quy mô tăng.

**[Chuyển]**: *Phần trình bày của em đến đây là hết.*

---

## Slide 33 — Cảm ơn & Q\&A (~20 giây)

**[Lời văn]**:

> Em xin chân thành cảm ơn các thầy, cô trong Hội đồng đã lắng nghe. [ngừng] Em rất mong nhận được nhận xét và câu hỏi để hoàn thiện đồ án. Em xin sẵn sàng trả lời ạ.

---

## Phụ lục — Câu hỏi Hội đồng hay hỏi & gợi ý trả lời

> Chuẩn bị trước, trả lời ngắn gọn, đúng trọng tâm.

**1. Quy tắc chuỗi danh hiệu căn cứ vào đâu?**
> Dạ, các tiêu chuẩn dựa trên Luật Thi đua, Khen thưởng số 06/2022 cùng các nghị định, thông tư hướng dẫn của Bộ Quốc phòng. Em mô hình hoá các tiêu chuẩn đó thành bảng cấu hình trong phần mềm để dễ cập nhật khi quy định thay đổi.

**2. Nếu quy định thay đổi cách xét thì sửa ở đâu, mất bao lâu?**
> Dạ, vì mỗi cấp danh hiệu chỉ là một dòng cấu hình (chu kỳ, số lượng, cửa sổ), nên khi quy định đổi, em chỉ sửa cấu hình mà gần như không phải đổi mã nguồn logic. Đây cũng là điểm em thiết kế hướng tới khả năng bảo trì.

**3. "Cửa sổ trượt" và "lỡ đợt" cụ thể là gì?**
> Cửa sổ trượt nghĩa là chỉ tính các danh hiệu đạt trong N năm gần nhất; danh hiệu cũ tự rơi ra. Lỡ đợt là khi đến mốc đủ điều kiện mà đơn vị chưa đề nghị — khi đó chu kỳ vẫn đếm tiếp, đến chu kỳ sau vẫn xét, không cần đạt lại từ đầu.

**4. Token để ở đâu, có an toàn không?**
> Dạ, refresh token đặt trong cookie HttpOnly, access token sống ngắn và có cơ chế làm mới luân phiên. Hệ thống chạy trong mạng nội bộ cách ly nên giảm đáng kể bề mặt tấn công. Tăng cường thêm như mã hoá dữ liệu khi lưu là hướng em sẽ hoàn thiện.

**5. Đã thử với dữ liệu thật chưa?**
> Dạ, em kiểm thử trên bộ dữ liệu mô phỏng sát thực tế và đối chiếu kết quả tự động với cách tính tay trên các kịch bản chính. Bước tiếp theo là chạy thử với dữ liệu thật tại Phòng Chính trị để cán bộ nghiệp vụ thẩm định.

**6. Vì sao khen thưởng đột xuất nằm ngoài mẫu Strategy?**
> Dạ, vì khen thưởng đột xuất không có quy tắc xét cố định theo chu kỳ như các nhóm khác, nên không cần đưa vào cùng một mẫu xử lý; gộp vào sẽ làm phức tạp không cần thiết.

**7. Bảo đảm nhất quán khi nhiều người duyệt cùng lúc thế nào?**
> Dạ, mỗi lần duyệt nằm trong một giao dịch của PostgreSQL, kết hợp kiểm tra phiên bản dữ liệu để chống ghi đè; nếu phát hiện dữ liệu đã bị người khác thay đổi thì hệ thống từ chối và yêu cầu tải lại.
