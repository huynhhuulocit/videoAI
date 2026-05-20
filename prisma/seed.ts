import { prisma, hashPassword } from "@videoai/database";

async function main() {
  const userPasswordHash = await hashPassword("User@123");
  const adminPasswordHash = await hashPassword("Admin@123");

  await prisma.userProfile.upsert({
    where: { username: "user" },
    update: {
      authUserId: "user_001",
      email: "user@videoai.local",
      passwordHash: userPasswordHash,
      displayName: "Demo User",
      role: "user",
      status: "active"
    },
    create: {
      id: "user_001",
      authUserId: "user_001",
      username: "user",
      email: "user@videoai.local",
      passwordHash: userPasswordHash,
      displayName: "Demo User",
      role: "user",
      status: "active"
    }
  });

  await prisma.userProfile.upsert({
    where: { username: "admin" },
    update: {
      authUserId: "admin_001",
      email: "admin@videoai.local",
      passwordHash: adminPasswordHash,
      displayName: "Admin",
      role: "admin",
      status: "active"
    },
    create: {
      id: "admin_001",
      authUserId: "admin_001",
      username: "admin",
      email: "admin@videoai.local",
      passwordHash: adminPasswordHash,
      displayName: "Admin",
      role: "admin",
      status: "active"
    }
  });

  await prisma.projectRecord.upsert({
    where: { id: "project_001" },
    update: {
      ownerUserId: "user_001",
      name: "Chiến dịch giới thiệu sản phẩm",
      description: "Tạo kịch bản, prompt và video để giới thiệu sản phẩm dễ hiểu, gần gũi.",
      flowType: "product",
      status: "active"
    },
    create: {
      id: "project_001",
      ownerUserId: "user_001",
      name: "Chiến dịch giới thiệu sản phẩm",
      description: "Tạo kịch bản, prompt và video để giới thiệu sản phẩm dễ hiểu, gần gũi.",
      flowType: "product",
      status: "active"
    }
  });

  await prisma.videoTemplateRecord.upsert({
    where: { id: "template_product_intro" },
    update: {
      ownerUserId: "user_001",
      name: "Template giới thiệu sản phẩm",
      description: "Các yếu tố cơ bản để tạo prompt video giới thiệu sản phẩm dễ hiểu.",
      idea: "Tạo video giới thiệu sản phẩm ngắn, rõ lợi ích và thân thiện.",
      attributes: [
        {
          id: "mood",
          name: "Cảm xúc",
          description: "Cảm giác chính mà video cần truyền tải.",
          options: [
            { id: "mood-friendly", label: "Thân thiện", value: "Thân thiện" },
            { id: "mood-premium", label: "Cao cấp", value: "Cao cấp" },
            { id: "mood-energetic", label: "Năng động", value: "Năng động" }
          ]
        },
        {
          id: "visual-style",
          name: "Phong cách hình ảnh",
          description: "Cách trình bày hình ảnh trong video.",
          options: [
            { id: "visual-closeup", label: "Cận cảnh sản phẩm", value: "Cận cảnh sản phẩm" },
            { id: "visual-lifestyle", label: "Lifestyle", value: "Lifestyle" },
            { id: "visual-minimal", label: "Tối giản", value: "Tối giản" }
          ]
        }
      ],
      status: "active"
    },
    create: {
      id: "template_product_intro",
      ownerUserId: "user_001",
      name: "Template giới thiệu sản phẩm",
      description: "Các yếu tố cơ bản để tạo prompt video giới thiệu sản phẩm dễ hiểu.",
      idea: "Tạo video giới thiệu sản phẩm ngắn, rõ lợi ích và thân thiện.",
      attributes: [
        {
          id: "mood",
          name: "Cảm xúc",
          description: "Cảm giác chính mà video cần truyền tải.",
          options: [
            { id: "mood-friendly", label: "Thân thiện", value: "Thân thiện" },
            { id: "mood-premium", label: "Cao cấp", value: "Cao cấp" },
            { id: "mood-energetic", label: "Năng động", value: "Năng động" }
          ]
        },
        {
          id: "visual-style",
          name: "Phong cách hình ảnh",
          description: "Cách trình bày hình ảnh trong video.",
          options: [
            { id: "visual-closeup", label: "Cận cảnh sản phẩm", value: "Cận cảnh sản phẩm" },
            { id: "visual-lifestyle", label: "Lifestyle", value: "Lifestyle" },
            { id: "visual-minimal", label: "Tối giản", value: "Tối giản" }
          ]
        }
      ],
      status: "active"
    }
  });

  await prisma.aiSiteConfig.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  });

  await prisma.aiSiteConfig.create({
    data: {
      contentMode: "script",
      promptProvider: "gemini",
      promptModel: "gemini-2.5-flash",
      videoProvider: "veo",
      videoModel: "veo-default",
      isActive: true,
      createdByAdminId: "admin_001"
    }
  });

  const existingLog = await prisma.aiRequestLog.findUnique({
    where: { requestId: "ai_req_001" }
  });

  if (!existingLog) {
    const requestLog = await prisma.aiRequestLog.create({
      data: {
        requestId: "ai_req_001",
        actorUserId: "user_001",
        actorRole: "user",
        projectId: "project_001",
        flowType: "script_prompt",
        provider: "gemini",
        model: "gemini-2.5-flash",
        requestPayload: {
          inputText: "Tạo video ngắn giới thiệu sản phẩm theo cách gần gũi.",
          mediaReferences: []
        },
        mediaReferences: [],
        status: "success",
        completedAt: new Date()
      }
    });

    await prisma.aiResponseLog.create({
      data: {
        requestLogId: requestLog.id,
        responsePayload: {
          generatedPrompt:
            "Video 20 giây mở đầu bằng cận cảnh sản phẩm, nêu lợi ích chính bằng ngôn ngữ dễ hiểu."
        },
        latencyMs: 1260
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
