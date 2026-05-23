const messages = {
  "common.admin": "Admin",
  "common.adminDashboard": "Admin Dashboard",
  "common.back": "Back",
  "common.cancelled": "Cancelled",
  "common.characterCount": "{count} chars",
  "common.completed": "Completed",
  "common.failed": "Failed",
  "common.login": "Login",
  "common.logout": "Logout",
  "common.no": "No",
  "common.none": "None",
  "common.default": "Default",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.open": "Open",
  "common.processing": "Processing {progress}%",
  "common.queued": "Queued {progress}%",
  "common.ready": "Ready",
  "common.setDefault": "Set default",
  "common.statusActive": "active",
  "common.user": "User",
  "common.userDashboard": "User Dashboard",
  "common.yes": "Yes",
  "shell.aiConfig": "AI Config",
  "shell.aiLogs": "AI Logs",
  "shell.ai": "AI",
  "shell.dashboard": "Dashboard",
  "shell.docsNote":
    "Code changes should update related docs when behavior changes.",
  "shell.docsSynced": "Docs synced",
  "shell.masterPromptScenario": "Scenario",
  "shell.masterPromptConfig": "Master Prompt Config",
  "shell.masterPromptShots": "Shots",
  "shell.masterPromptStory": "Story Content",
  "shell.oneClick": "One Click",
  "shell.projectWorkspace": "Projects",
  "shell.scenario": "Scenario",
  "shell.scenarioAttribute": "Scenario Attribute",
  "shell.scenarioMasterPrompt": "Scenario Master Prompt",
  "shell.shotPrompt": "Master Prompt",
  "shell.shotAttribute": "Shot Attribute",
  "shell.shotGroup": "Shot",
  "shell.shotMasterPrompt": "Shot Master Prompt",
  "shell.shotsAttribute": "Shots Attribute",
  "shell.shotsGroup": "Shots",
  "shell.shotsMasterPrompt": "Shots Master Prompt",
  "shell.story": "Story",
  "shell.storyAttribute": "Story Attribute",
  "shell.storyMasterPrompt": "Story Master Prompt",
  "shell.templates": "Scenario",
  "home.adminConfig": "Admin config",
  "home.cardAdminBody":
    "Configure providers and inspect AI request/response logs without exposing secrets.",
  "home.cardAdminTitle": "Admin AI governance",
  "home.cardPromptBody":
    "Generate reviewable prompts from script input, product URLs, images, and videos.",
  "home.cardPromptTitle": "Prompt and script generation",
  "home.cardWorkspaceBody":
    "Track projects, uploads, generated prompts, scripts, jobs, and outputs in one workspace.",
  "home.cardWorkspaceTitle": "Video-ready project workspace",
  "home.aiHandoffTitle": "AI Handoff extension",
  "home.aiHandoffBody":
    "Install from Chrome Web Store to send one generated shot prompt to an allowlisted AI website after you click AI Handoff. Media upload stays manual in v1.",
  "home.aiHandoffInstall": "Install extension",
  "home.aiHandoffInstallUnavailable": "Store install unavailable",
  "home.aiHandoffCheck": "Check installed",
  "home.aiHandoffChecking": "Checking extension",
  "home.aiHandoffDetected": "Extension detected",
  "home.aiHandoffNotDetected": "Extension is not detected in this browser.",
  "home.aiHandoffDisabled":
    "AI Handoff is not configured for this environment.",
  "home.aiHandoffLocalInstallMode":
    "Local extension mode: load apps/chrome-extension/dist from chrome://extensions, reload the extension after each build, then click Check installed.",
  "home.aiHandoffExtensionIdMissing":
    "Extension ID is not configured yet. Set NEXT_PUBLIC_AI_HANDOFF_EXTENSION_ID after installing or publishing the extension.",
  "home.aiHandoffSafety":
    "The extension never stores provider passwords, cookies, or API keys, and only runs on configured target origins.",
  "home.eyebrow": "AI video workflow",
  "home.headline":
    "Create product scripts and video prompts from text, URLs, and reference media.",
  "home.startDemo": "Start with demo account",
  "home.subcopy":
    "VideoAI gives users a project workspace for prompt generation and gives admins control over AI providers, model defaults, keys, and request logs.",
  "login.demoPrefix": "Demo users:",
  "login.or": "or",
  "login.password": "Password",
  "login.title": "Login to VideoAI",
  "login.username": "Username",
  "dashboard.action": "Action",
  "dashboard.createProject": "Create Project",
  "dashboard.description":
    "Create projects, generate prompts/scripts, and track video jobs.",
  "dashboard.failedJobs": "Failed jobs",
  "dashboard.flow": "Flow",
  "dashboard.project": "Project",
  "dashboard.projects": "Projects",
  "dashboard.recentProjects": "Recent projects",
  "dashboard.status": "Status",
  "dashboard.title": "Projects",
  "dashboard.updated": "Updated",
  "dashboard.videos": "Videos",
  "projects.description":
    "All of your Scenario and Product Flow projects, ready to reopen or extend.",
  "projects.delete": "Delete project",
  "projects.deleteConfirm":
    'Delete project "{name}"? It will be hidden from the project list.',
  "projects.deleteFailed": "Cannot delete project.",
  "projects.empty":
    "No projects yet. Create your first project to start the video workflow.",
  "projects.listTitle": "All projects",
  "projects.title": "Projects",
  "flow.product": "Product Flow",
  "flow.script": "Scenario",
  "projectCreate.cardFlow": "Choose how to start",
  "projectCreate.cardInfo": "Project information",
  "projectCreate.create": "Create project",
  "projectCreate.defaultDescription":
    "Create clear, friendly product introduction content.",
  "projectCreate.defaultName": "Product introduction campaign",
  "projectCreate.description":
    "Choose Scenario or Product Flow up front so the workspace stays focused.",
  "projectCreate.descriptionField": "Short description",
  "projectCreate.errorName": "Enter a project name.",
  "projectCreate.errorSubmit": "Cannot create project.",
  "projectCreate.name": "Project name",
  "projectCreate.productDescription":
    "Start from a product link, images, or reference videos so AI can analyze the strongest selling points.",
  "projectCreate.scriptDescription":
    "Start from an idea, prompt, or scenario, then let AI suggest stronger content.",
  "projectCreate.title": "Create new project",
  "oneClick.backStep": "Back",
  "oneClick.create": "Create One Click project",
  "oneClick.createFailed": "Cannot create One Click project.",
  "oneClick.description":
    "Create a Scenario project through a guided Story Content, Scenario and Shots wizard.",
  "oneClick.errorName": "Enter a project name.",
  "oneClick.name": "Project name",
  "oneClick.namePlaceholder": "One Click video project",
  "oneClick.nextStep": "Next",
  "oneClick.openProject": "Open full project",
  "oneClick.shortcutBadge": "Guided shortcut",
  "oneClick.setupDescription": "Description",
  "oneClick.startHelp":
    "One Click creates a normal Scenario project, then guides you through Story Content, Scenario analysis, and shot generation.",
  "oneClick.startTitle": "Start One Click",
  "oneClick.step1Short": "Story Content",
  "oneClick.step2DefaultScenario": "Scenario catalog used for analysis: {name}",
  "oneClick.step2FullPrompt": "Full One Click Scenario prompt",
  "oneClick.step2FullPromptHelp":
    "The exact Scenario master prompt after replacing placeholders present in it.",
  "oneClick.step2Help":
    "Use the Scenario master prompt and the selected Scenario attribute catalog to let AI select matching attributes for the story. One Click skips the scenario dropdown and saves the generated Scenario with the setup name and description.",
  "oneClick.step2PromptHelp":
    "This admin-managed Scenario master prompt can be edited temporarily for this One Click analysis; runtime data is included only through placeholders in this prompt.",
  "oneClick.step2PromptLabel": "Scenario master prompt",
  "oneClick.step2Short": "Scenario",
  "oneClick.step2StoryHelp":
    "This Story Content is analyzed against the Scenario attributes, then reused by the Shots master prompt in Step 3.",
  "oneClick.step2Title": "Step 2 · Scenario",
  "oneClick.step3Short": "Prompt Shots",
  "oneClick.step3SavedShotPlan": "Project shot plan saved: {name}",
  "oneClick.stepNumber": "Step {step}",
  "oneClick.storySaved": "Story Content saved",
  "oneClick.storySaveFailed": "Cannot save Story Content.",
  "oneClick.storySaving": "Saving Story Content...",
  "oneClick.title": "One Click",
  "oneClick.wizardDescription":
    "A guided Scenario shortcut with Story Content, Scenario analysis, and editable shot generation.",
  "oneClick.wizardTitle": "One Click Wizard",
  "projectDetail.defaultPrompt":
    "Create a short product introduction video in a friendly style, clearly stating the key benefit and why customers should care.",
  "projectDetail.description":
    "Turn product descriptions, sales links, and reference images/videos into clear, friendly introduction content.",
  "projectDetail.fallbackTitle": "Product introduction workspace",
  "workspace.aiOutput": "AI suggested content",
  "workspace.analyze": "Analyze",
  "workspace.analyzeFailed": "Product analysis failed",
  "workspace.analyzingProduct": "Sending product analysis request",
  "workspace.chooseFile": "Choose file",
  "workspace.createScript": "Create script",
  "workspace.createScriptFailed": "Script creation failed",
  "workspace.createScriptSuccess": "Script created",
  "workspace.creating": "Creating...",
  "workspace.creatingScript": "Creating script",
  "workspace.dropzoneEmpty": "No reference images or videos yet.",
  "workspace.finalContent": "Final content",
  "workspace.finalPlaceholder":
    "AI suggested content will appear here. You can edit it before creating a script.",
  "workspace.generate": "Generate",
  "workspace.generateFailed": "Content suggestion failed",
  "workspace.generateSuccess": "Suggested content is ready",
  "workspace.generatingPrompt": "Sending content suggestion request",
  "workspace.inputLabel": "How do you want to introduce the product?",
  "workspace.invalidFileType":
    "Only JPG, PNG, WebP, MP4, MOV, and WebM are supported.",
  "workspace.invalidProductUrl": "Enter a valid product link before analyzing.",
  "workspace.invalidVideoDuration": "Cannot check the video duration.",
  "workspace.mediaCount":
    "{count} valid media file(s) will be used as reference.",
  "workspace.mediaHelp":
    "Add sample images or videos so AI can understand the product style, camera angles, and context.",
  "workspace.mediaTitle": "Reference images/videos",
  "workspace.mediaTypes":
    "JPG, PNG, WebP up to 10 MB. MP4, MOV, WebM up to 200 MB and 3 minutes.",
  "workspace.noMediaInsight":
    "No reference media yet. AI will rely on the description or product link to suggest content.",
  "workspace.productFacts": "Product facts",
  "workspace.productHelp":
    "AI will read the product link and reference media to suggest key highlights, style direction, and suitable introduction content.",
  "workspace.productLabel": "Product link",
  "workspace.productSuccess": "Product analysis completed",
  "workspace.productTemplateHelp":
    "Select the options AI should use as structure when generating the prompt.",
  "workspace.productTemplateTitle": "Prompt scenario",
  "workspace.projectSave": "Save Project",
  "workspace.projectSaved": "Project saved",
  "workspace.projectSaveFailed": "Project save failed",
  "workspace.projectSaving": "Saving Project...",
  "workspace.referenceReady": "Media is ready",
  "workspace.rejectedFiles": "Some files are invalid",
  "workspace.removeMedia": "Remove {name}",
  "workspace.scriptCreated": "Script created:",
  "workspace.selectedFlow": "Selected when creating the project",
  "workspace.shotsAdd": "Add shot",
  "workspace.shotsAddAttribute": "Add attribute",
  "workspace.shotsAttributeName": "Attribute name",
  "workspace.shotsAttributeValue": "Attribute value",
  "workspace.shotAttributesCount": "{count} attribute(s)",
  "workspace.shotAttributesPanelHelp":
    "Open Attributes to edit this shot's attributes. These values are included when Create Prompt runs.",
  "workspace.shotDialogue": "Dialogue",
  "workspace.shotDialogueEmpty": "No dialogue yet.",
  "workspace.shotDialoguePlaceholder":
    "Enter dialogue, voiceover, or narration for this shot.",
  "workspace.shotsDurationInput": "Shot {index} duration",
  "workspace.shotsCardsHelp":
    "Edit generated shots, attach reference media, create shot prompts, and submit video generation per shot.",
  "workspace.shotsCardsTitle": "Step 4 · Shots",
  "workspace.shotsGenerate": "Generate shots",
  "workspace.shotsGenerateFailed": "Shot generation failed",
  "workspace.shotsEditorHelp":
    "These cards are rebuilt from the Shots result JSON and stay synchronized while the JSON is valid.",
  "workspace.shotsEditorTitle": "Shot cards",
  "workspace.shotsGenerated": "Shots generated",
  "workspace.shotsGeneratedDetail":
    "{count} shot(s) generated. Review and edit the shots below.",
  "workspace.shotsGenerating": "Generating shots",
  "workspace.shotsHelp":
    "AI breaks the current content into video shots up to 8 seconds each for prompt generation.",
  "workspace.shotsMasterPromptHelp":
    "This default prompt is managed by admin for shot generation. You can edit it temporarily for this generation; runtime data is included only through placeholders in this prompt.",
  "workspace.shotsMasterPromptLabel": "Shots master prompt",
  "workspace.shotsMasterPromptMissing":
    "Enter a shots master prompt before generating shots.",
  "workspace.shotsMissingSource":
    "Enter a script or generate final content before generating shots.",
  "workspace.shotsName": "Shot group name",
  "workspace.shotsNeedOne": "Add at least one shot before saving.",
  "workspace.shotsNone":
    "No shots exist for this project yet. Generate shots or paste valid Shots result JSON.",
  "workspace.shotsRemove": "Remove {title}",
  "workspace.shotsRemoveAttribute": "Remove attribute",
  "workspace.shotsResultHelp":
    "Edit the normalized JSON returned from shot generation. When the JSON is valid, the shot cards below update immediately. Save shots persists the synced shots.",
  "workspace.shotsResultInvalid": "Shots result JSON is invalid.",
  "workspace.shotsResultPlaceholder":
    "Generate shots to fill this JSON, or paste normalized shots JSON to sync the shot cards.",
  "workspace.shotsResultTitle": "Shots result",
  "workspace.shotsSave": "Save shots",
  "workspace.shotsSaveFailed": "Shot save failed",
  "workspace.shotsSaved": "Shots saved",
  "workspace.shotsSaving": "Saving shots",
  "workspace.shotsAdminManaged":
    "Shot generation prompts are managed in Admin > Master Prompt.",
  "workspace.shotsScenarioAttributes":
    "Shot AI will use the Step 2 selected attributes: {attributes};",
  "workspace.shotsScenarioAttributesEmpty":
    "No Step 2 attributes are selected for this shot generation yet.",
  "workspace.shotsSourceFromScenario":
    "Shot generation uses the story content entered in Step 1.",
  "workspace.shotsSelect": "Select shots",
  "workspace.shotsTitle": "Step 3 · Prompt shots",
  "workspace.shotsTitleInput": "Shot {index} title",
  "workspace.shotsUse": "Use shot",
  "workspace.adminShotAttributesHelp":
    "Open Shot Attributes to edit reusable admin-defined values for this individual shot. Required attributes always keep at least one option selected.",
  "workspace.adminShotAttributesTitle": "Shot Attributes",
  "workspace.masterPromptAttributesUserBlocked":
    "{masterPromptAttributes} is admin-only and cannot be used in user workspace prompt overrides.",
  "workspace.shotGeneratedAttributesTitle": "Generated shot attributes",
  "workspace.shotMasterPromptHelp":
    "This admin-managed Shot master prompt creates the final prompt for one shot. Use placeholders to include shot fields, Shot Attributes, and reference media.",
  "workspace.shotMasterPromptLabel": "Shot master prompt",
  "workspace.shotMasterPromptMissing":
    "Active Shot master prompt is required before creating a shot prompt.",
  "workspace.shotAttributeCatalogMissing":
    "Active Shot Attribute catalog is required because this Shot master prompt contains {shotAttributes}.",
  "workspace.shotPromptAttributes": "Shot attributes",
  "workspace.shotPromptCopied": "Prompt copied",
  "workspace.shotPromptCopy": "Copy prompt",
  "workspace.shotPromptCopyFailed": "Cannot copy prompt",
  "workspace.shotPromptDescription": "Description",
  "workspace.shotPromptDialogue": "Dialogue",
  "workspace.shotPromptDuration": "Duration",
  "workspace.shotPromptGenerate": "Create Prompt",
  "workspace.shotPromptGenerated": "Shot prompt created",
  "workspace.shotPromptMedia": "Reference media",
  "workspace.shotPromptNoAttributes": "No attributes for this shot yet.",
  "workspace.shotPromptNoPlanAttributes": "No shot plan attributes yet.",
  "workspace.shotPromptPlanAttributes": "Shot plan attributes",
  "workspace.shotPromptNoMedia": "No valid media yet.",
  "workspace.shotPromptNoTemplateOptions": "No scenario options selected.",
  "workspace.shotPromptShot": "Shot to create",
  "workspace.shotPromptSource": "Source context",
  "workspace.shotPromptTemplate": "Selected scenario",
  "workspace.shotPromptTitle": "Complete prompt for this shot",
  "workspace.shotPromptPopupHelp":
    "Review the complete prompt for this shot. This popup is read-only and does not call AI.",
  "workspace.shotPromptTitleField": "Title",
  "workspace.shotVideoCreate": "Create video",
  "workspace.shotVideoCreating": "Creating video",
  "workspace.shotVideoFailed": "Video generation failed",
  "workspace.shotVideoMissingPrompt":
    "A shot prompt is required before creating video.",
  "workspace.shotVideoRawRequest": "Raw shot video request",
  "workspace.shotVideoRawRequestHelp":
    "The redacted request for creating video from this shot prompt.",
  "workspace.shotVideoRawResponse": "Raw shot video response",
  "workspace.shotVideoRawResponseHelp":
    "The provider response or job error returned while creating video for this shot.",
  "workspace.shotVideoSuccess":
    "Video generation request completed for this shot.",
  "workspace.aiHandoffButton": "AI Handoff",
  "workspace.aiHandoffSending": "Sending handoff",
  "workspace.aiHandoffSuccess": "Prompt sent to AI Handoff extension",
  "workspace.aiHandoffFailed": "AI Handoff failed",
  "workspace.aiHandoffDisabled":
    "AI Handoff is not configured for this environment.",
  "workspace.aiHandoffExtensionMissing":
    "AI Handoff extension is not detected. Install it from the Chrome Web Store, then try again.",
  "workspace.aiHandoffExtensionRejected":
    "The AI Handoff extension rejected the request.",
  "workspace.aiHandoffTargetMissing":
    "AI Handoff target URL is not configured. Ask an admin to set Admin > AI Config > AI Handoff target URL.",
  "workspace.aiHandoffTargetInvalid":
    "AI Handoff target URL is invalid. Ask an admin to save a valid target URL in Admin > AI Config.",
  "workspace.aiHandoffPromptSelectorMissing":
    "AI Handoff prompt selector is not configured. Open Flow, run Check DOM, then try again.",
  "workspace.shotMediaEmpty": "No reference media for this shot yet.",
  "workspace.shotMediaHelp":
    "Add images or videos for this shot so the prompt can follow the right context, camera angle, and visual style.",
  "workspace.shotMediaSaved": "Shot reference media saved",
  "workspace.shotMediaSaveFailed": "Cannot save shot reference media",
  "workspace.shotMediaTitle": "Shot reference media",
  "workspace.templateCreateLink": "Create scenario",
  "workspace.templateHelp":
    "Use the active Admin Scenario attribute catalog to select structure for the prompt.",
  "workspace.templateAttributesHelp":
    "Open Scenario Attributes to review or select options used for analysis and prompt generation. Required attributes always keep at least one option selected.",
  "workspace.templateAttributesTitle": "Scenario Attributes",
  "workspace.scenarioHelperDescription": "Description",
  "workspace.scenarioHelperOpen": "Show scenario translate and description",
  "workspace.scenarioHelperTranslate": "Translate",
  "workspace.templateMasterPromptHelp":
    "This default prompt is managed by admin. You can edit it temporarily for this analysis. Use {scenarioAttributes} to include the active Scenario catalog.",
  "workspace.templateMasterPromptLabel": "Scenario analysis master prompt",
  "workspace.templateMasterPromptMissing":
    "Enter a master prompt before analyzing the scenario.",
  "workspace.templateNone":
    "No active Admin Scenario attribute catalog is configured.",
  "workspace.templateSelect": "Choose scenario",
  "workspace.templateStoryHelp":
    "This content is combined with the master prompt for option analysis and reused as the shot-generation source.",
  "workspace.templateStoryLabel": "Story content",
  "workspace.templateTitle": "Step 2 · Prompt scenario",
  "workspace.templateAnalyze": "Analyze scenario",
  "workspace.templateAnalyzing": "Analyzing scenario",
  "workspace.templateAnalyzeFailed": "Scenario analysis failed",
  "workspace.aiErrorActiveProvider": "the active provider",
  "workspace.aiErrorCode": "Error code: {code}",
  "workspace.aiErrorConfigMissing":
    "Missing API key for {provider}. Save a key in Admin > AI Config, then try again.",
  "workspace.aiErrorEnv": "Key source hint: {env}",
  "workspace.aiErrorIssues":
    "Schema/JSON issue: {count} issue(s). First issue: {firstIssue}",
  "workspace.aiErrorJobId": "Job ID: {jobId}",
  "workspace.aiErrorJobNotFound":
    "The analysis job could not be found. Reload the page and run it again.",
  "workspace.aiErrorModel": "Model: {model}",
  "workspace.aiErrorNoIssuePreview": "no detailed issue available",
  "workspace.aiErrorProvider": "Provider: {provider}",
  "workspace.aiErrorProviderEnv": "the saved provider API key",
  "workspace.aiErrorProviderFailed":
    "The provider/model returned an error or did not return the required JSON. Check provider/model, the master prompt, and AI Logs for the redacted raw response.",
  "workspace.aiErrorProviderMessage": "Technical message: {message}",
  "workspace.aiErrorRateLimited":
    "The provider is rate-limited or out of quota. Wait, switch model/provider, or check billing/quota.",
  "workspace.aiErrorStatus": "HTTP status: {status}",
  "workspace.aiErrorUnknown":
    "AI analysis did not complete successfully. Check configuration and try again.",
  "workspace.aiErrorValidation":
    "The request is invalid. Check the story content, master prompt, and selected scenario.",
  "workspace.templateAnalyzeSuccess": "Matching options selected",
  "workspace.templateAnalysisResult": "AI suggested selection",
  "workspace.templateSelectionSave": "Save selection",
  "workspace.templateSelectionSaved": "Selection saved to project",
  "workspace.templateSelectionSaveFailed": "Cannot save scenario selection",
  "workspace.templateSelectionSaving": "Saving selection",
  "workspace.templateSelectedCount": "{count} selected",
  "workspace.tooLargeImage": "Each image must be 10 MB or less.",
  "workspace.tooLargeTotal": "Total media size must be 500 MB or less.",
  "workspace.tooLargeVideo": "Each video must be 200 MB or less.",
  "workspace.tooLongVideo": "Each video must be 3 minutes or less.",
  "workspace.tooManyFiles": "Each generation can use up to 10 media files.",
  "workspace.tooManySkipped":
    "Some files were skipped because each generation supports up to 10 files.",
  "workspace.validImage": "Valid image",
  "workspace.validVideo": "Valid video",
  "workspace.mediaInsights": "Media insights",
  "workspace.missingFinal":
    "Enter or generate final content before creating a script.",
  "workspace.missingPrompt":
    "Enter Story Content or an idea before generating content.",
  "workspace.storyGenerate": "Generate Story Content",
  "workspace.storyGenerateFailed": "Story Content generation failed",
  "workspace.storyGenerating": "Generating Story Content",
  "workspace.storyGenerateSuccess": "Story Content updated",
  "workspace.storyInputHelp":
    "This content is the shared source for scenario analysis, shot generation, and script creation in the following steps. You can enter it directly or use AI to normalize it into story content.",
  "workspace.storyInputLabel": "Story Content",
  "workspace.storyMasterPromptHelp":
    "The admin-managed Story Content master prompt turns your source text into a richer story for later Scenario and Shots steps. Use {storyContent} and {storyAttributes} to include runtime data.",
  "workspace.storyMasterPromptLabel": "Story Content master prompt",
  "workspace.storyMasterPromptMissing":
    "Enter a Story Content master prompt before generating content.",
  "workspace.storyStepHelp":
    "Story Content is the shared source used by Scenario, Shots, and later content steps.",
  "workspace.storyStepTitle": "Step 1 · Story Content",
  "workspace.rawDataClose": "Close raw data",
  "workspace.rawDataUnavailable": "No raw data yet. Run AI first.",
  "workspace.fullPromptButton": "Prompt",
  "workspace.fullPromptUnavailable":
    "Not enough data to build the full prompt. Enter content and a master prompt first.",
  "workspace.rawRequestButton": "Request",
  "workspace.rawResponseButton": "Response",
  "workspace.storyFullPrompt": "Full Story Content prompt",
  "workspace.storyFullPromptHelp":
    "The exact Story Content master prompt after replacing any placeholders present in it.",
  "workspace.storyRawRequest": "Raw Story Content request",
  "workspace.storyRawRequestHelp":
    "The redacted provider payload with the exact rendered master prompt sent to AI.",
  "workspace.storyRawResponse": "Raw Story Content response",
  "workspace.storyRawResponseHelp":
    "The provider response before the system writes the generated text back into Story Content.",
  "workspace.scenarioFullPrompt": "Full Scenario analysis prompt",
  "workspace.scenarioFullPromptHelp":
    "The exact Scenario master prompt after replacing any {story}/{scenarioAttributes} placeholders present in it.",
  "workspace.scenarioRawRequest": "Raw Scenario analysis request",
  "workspace.scenarioRawRequestHelp":
    "The redacted provider payload with the exact rendered Scenario master prompt sent to AI.",
  "workspace.scenarioRawResponse": "Raw Scenario analysis response",
  "workspace.scenarioRawResponseHelp":
    "The provider response before the system normalizes it and selects matching options.",
  "workspace.shotsFullPrompt": "Full Shots prompt",
  "workspace.shotsFullPromptHelp":
    "The exact Shots master prompt after replacing any {story}/{scenarioAttributes}/{shotsAttributes} placeholders present in it.",
  "workspace.productRawRequest": "Raw product analysis request",
  "workspace.productRawRequestHelp":
    "The request payload used for the current product analysis, with sensitive data removed.",
  "workspace.productRawResponse": "Raw product analysis response",
  "workspace.productRawResponseHelp":
    "The response data used to build product facts, media insights, and final content.",
  "workspace.promptPreviewClose": "Close prompt preview",
  "workspace.promptPreviewComposed": "AI prompt preview",
  "workspace.promptPreviewEmptyInput": "No content entered yet.",
  "workspace.promptPreviewEmptyProductUrl": "No product link entered yet.",
  "workspace.promptPreviewHelp":
    "This is the current prompt/payload that will be used when you generate content. The popup is read-only and does not send an AI request.",
  "workspace.promptPreviewInput": "User input: {input}",
  "workspace.promptPreviewMedia":
    "Use {count} valid media file(s) as reference for style, lighting, composition, camera angle, and pacing.",
  "workspace.promptPreviewNoMedia":
    "No valid media yet; AI will rely on text content or the product link.",
  "workspace.promptPreviewNoShots": "No shots selected.",
  "workspace.promptPreviewNoTemplate": "No scenario options selected.",
  "workspace.promptPreviewOpen": "View hidden prompt",
  "workspace.promptPreviewProductBase":
    "Analyze the product link and create a short commerce video prompt with clear key benefits.",
  "workspace.promptPreviewProductUrl": "Product link: {url}",
  "workspace.promptPreviewRequest": "Request JSON",
  "workspace.promptPreviewScriptBase":
    "Create short, friendly, easy-to-understand product introduction content.",
  "workspace.promptPreviewShots": "Use selected shots: {shots}.",
  "workspace.promptPreviewTemplate":
    "Apply scenario {templateName}: {selections}.",
  "workspace.promptPreviewTitle": "Prompt sent to AI",
  "workspace.requestIncomplete": "The request did not complete successfully.",
  "shots.createTitle": "Create script",
  "shots.defaultSource":
    "You are an exceptional screenwriter for AI Veo video.\n\nTask: read the story below and split it into many short shots, each up to 8 seconds. Every shot must include a clear Start state and End state. The next shot's Start state must continue from the previous shot's End state so the video stays continuous by last-state / end-state logic.\n\nFor every shot, create action, setting, camera, emotion, transition point, and beginning/ending state details. Prefer concrete, filmable, emotionally clear visuals with no abrupt scene jumps.\n\nStory content:\n{story}",
  "shots.description":
    "Create reusable scripts/shot plans for your account, save them to the database, and select them in any project workspace.",
  "shots.delete": "Delete shot plan",
  "shots.deleteConfirm": 'Delete shot plan "{name}"?',
  "shots.deleteFailed": "Cannot delete shot plan.",
  "shots.defaultFailed": "Cannot set the default shot plan.",
  "shots.editorDescription": "Add or edit a reusable shot plan.",
  "shots.editTitle": "Edit shot plan",
  "shots.emptyList": "No shot plans yet.",
  "shots.loadFailed": "Cannot load shot plans.",
  "shots.loading": "Loading shot plans...",
  "shots.invalidAiJson": "AI returned invalid JSON.",
  "shots.missingSource": "Enter story content before generating shots.",
  "shots.missingProviderKey": "The prompt provider API key is missing.",
  "shots.addPlanAttribute": "Add attribute",
  "shots.fixedPrompt": "Fixed screenwriter prompt",
  "shots.fixedPromptHelp":
    "The system uses an admin-managed fixed prompt with Start state / End state continuity. You only see the summary and enter story content below.",
  "shots.noPlanAttributes": "No shot plan attributes yet.",
  "shots.new": "Add shot plan",
  "shots.newTitle": "Add shot plan",
  "shots.noProjects":
    "No shot plans yet. Enter a story and create the first shot plan.",
  "shots.noScriptProjects":
    "No Scenario project exists yet. Create a Scenario project before generating shots.",
  "shots.notFound": "Shot plan not found.",
  "shots.openProject": "Open project workspace",
  "shots.planAttributes": "Shot plan attributes",
  "shots.planAttributesHelp":
    "These attributes apply to the whole shot plan when AI breaks the story into shots.",
  "shots.planAttributesPrompt": "Attributes that apply to the whole shot plan:",
  "shots.project": "Project",
  "shots.rawRequest": "Raw request sent to AI",
  "shots.rawRequestHelp":
    "The redacted provider request used to inspect the prompt and body before AI processing.",
  "shots.rawResponse": "Raw AI response JSON",
  "shots.rawResponseHelp":
    "This data is used to build the editable shot plan below after normalization. Raw JSON is only kept in the job result and AI logs.",
  "shots.refresh": "Refresh",
  "shots.listTitle": "Shot plans list",
  "shots.savedTitle": "Saved shot plans",
  "shots.shotCount": "{count} shot(s)",
  "shots.savedPlanAttributesHelp":
    "These attributes are saved with the shot plan and used when the plan is selected for prompt composition.",
  "shots.sourcePlaceholder":
    "Keep the fixed prompt and replace only the story section so AI can split it into shots.",
  "shots.storyInputPlaceholder":
    "Paste your long story or script content here.",
  "shots.storyPlaceholder":
    "Paste or write the story content that should be split into shots.",
  "shots.storyText": "Story content",
  "shots.sourceText": "Source content",
  "shots.title": "Shot plans",
  "shots.updated": "Updated {date}",
  "template.addAttribute": "Add attribute",
  "template.addOption": "Add option",
  "template.aiBuilder": "AI scenario builder",
  "template.attributeName": "Attribute name",
  "template.attributeDescription": "Attribute description",
  "template.builder": "Scenario content",
  "template.description":
    "Create and save scenario attributes/options used to generate video prompts.",
  "template.descriptionField": "Description",
  "template.delete": "Delete scenario",
  "template.deleteConfirm": 'Delete scenario "{name}"?',
  "template.deleted": "Scenario deleted",
  "template.deleteFailed": "Cannot delete scenario",
  "template.defaultFailed": "Cannot set the default scenario.",
  "template.empty": "No scenarios yet.",
  "template.editorDescription": "Add or edit a reusable scenario.",
  "template.editTitle": "Edit scenario",
  "template.generate": "Generate scenario with AI",
  "template.generating": "Generating...",
  "template.generationFullPrompt": "Full Scenario generation prompt",
  "template.generationFullPromptHelp":
    "The exact Scenario master prompt after replacing any {story}/{attributes} placeholders present in it.",
  "template.generationRawRequest": "Raw Scenario generation request",
  "template.generationRawRequestHelp":
    "The redacted provider payload sent when the Scenario was generated.",
  "template.generationRawResponse": "Raw Scenario generation response",
  "template.generationRawResponseHelp":
    "The provider response before the system normalizes and saves the Scenario.",
  "template.idea": "Video idea",
  "template.ideaPlaceholder":
    "Example: create a video about a baby's happy day",
  "template.jsonApplied": "Schema parsed",
  "template.jsonApply": "Parse schema",
  "template.jsonEditor": "Attribute/option schema",
  "template.jsonHelp":
    "Use optimized JSON with id, name, description and options. Option name is stored as the processing label; description is helper text. Legacy label/value/translate JSON and compact key=value text are still supported.",
  "template.jsonInvalid": "Attribute/option schema is invalid.",
  "template.list": "Saved scenarios",
  "template.loading": "Loading scenarios...",
  "template.masterPromptLoadFailed": "Cannot load the Scenario master prompt.",
  "template.name": "Scenario name",
  "template.new": "Add scenario",
  "template.newTitle": "Add scenario",
  "template.notFound": "Scenario not found.",
  "template.optionLabel": "Option label",
  "template.optionDescription": "Option description",
  "template.save": "Save scenario",
  "template.saved": "Scenario saved",
  "template.saving": "Saving...",
  "template.scenarioMasterPrompt": "Scenario master prompt",
  "template.scenarioMasterPromptHelp":
    "This admin-managed default prompt can be edited temporarily for this generation; runtime data is included only through placeholders in this prompt.",
  "template.scenarioMasterPromptMissing":
    "Enter a Scenario master prompt before generating with AI.",
  "template.scenarioMasterPromptPlaceholder":
    "Enter the Scenario master prompt for this generation.",
  "template.title": "Scenario",
  "template.attributeCount": "{count} attributes",
  "adminConfig.apiKey": "API key",
  "adminConfig.apiKeyPlaceholder":
    "Enter a new key, then use Save configuration",
  "adminConfig.chatGptApiNote":
    "ChatGPT Plus is for the ChatGPT app. This app still needs an OpenAI API key saved in Admin > AI Config for the ChatGPT/OpenAI provider.",
  "adminConfig.contentMode": "Content mode",
  "adminConfig.createScript": "Create Script",
  "adminConfig.createScriptHelp":
    "Users can generate prompts/scripts for review.",
  "adminConfig.createVideo": "Create Video",
  "adminConfig.createVideoHelp":
    "Users can submit final prompts to video generation.",
  "adminConfig.description":
    "Control site-wide prompt/script and video generation behavior.",
  "adminConfig.model": "Model",
  "adminConfig.aiHandoff": "AI Handoff",
  "adminConfig.aiHandoffDomDetector": "JS DOM detector script",
  "adminConfig.aiHandoffDomDetectorHelp":
    "Copy this script, paste it into the target AI page console, then click the prompt input or Generate button to export selectors for the extension adapter.",
  "adminConfig.aiHandoffHelp":
    "Target URL is saved in Admin config and sent to the extension. If the target origin changes, update the extension allowlist and adapter config.",
  "adminConfig.aiHandoffProvider": "AI Handoff provider",
  "adminConfig.aiHandoffTargetUrl": "AI Handoff target URL",
  "adminConfig.aiHandoffPromptSelector": "AI Handoff prompt selector",
  "adminConfig.aiHandoffTargetUrlInvalid":
    "Enter a valid AI Handoff target URL or leave it blank to disable handoff.",
  "adminConfig.copyDomDetectorScript": "Copy script",
  "adminConfig.domDetectorCopied": "Script copied",
  "adminConfig.domDetectorCopyFailed": "Cannot copy script",
  "adminConfig.promptProvider": "Prompt provider/model",
  "adminConfig.provider": "Provider",
  "adminConfig.providerModelRequired":
    "Enter provider and model before testing.",
  "adminConfig.keyRequired": "Enter an API key before saving.",
  "adminConfig.keySaved": "Key saved with configuration",
  "adminConfig.keySaveFailed": "Cannot save key",
  "adminConfig.keyStatusConfigured": "configured",
  "adminConfig.keyStatusEnv": "missing",
  "adminConfig.keyStatusMissing": "missing",
  "adminConfig.promptProviderHelp":
    "Enter any provider/model. Gemini and ChatGPT/OpenAI have live adapters; other providers need matching adapters.",
  "adminConfig.save": "Save configuration",
  "adminConfig.saved": "Configuration saved",
  "adminConfig.saveFailed": "Cannot save configuration",
  "adminConfig.saveKey": "Save key",
  "adminConfig.showUserMasterPrompts": "Show master prompts in user workspace",
  "adminConfig.showUserMasterPromptsHelp":
    "No hides the editable Story, Scenario, and Shots master prompt fields in Project and One Click. Prompt preview buttons remain visible, and AI uses the active admin defaults.",
  "adminConfig.siteConfig": "Site Config",
  "adminConfig.testConnect": "Test connect",
  "adminConfig.testFailed": "Test failed",
  "adminConfig.testSuccess": "Test OK",
  "adminConfig.title": "AI Config",
  "adminConfig.updated": "Updated {date}",
  "adminConfig.videoProvider": "Video provider/model",
  "adminShotPrompt.customMode": "Using custom prompt",
  "adminShotPrompt.composerCustomMode": "Per-shot prompt uses custom prompt",
  "adminShotPrompt.composerDefaultMode": "Per-shot prompt uses default prompt",
  "adminShotPrompt.composerEditor": "Per-shot composed prompt",
  "adminShotPrompt.composerPlaceholderHelp":
    "This prompt renders locally when users click Create Prompt inside a shot.",
  "adminShotPrompt.composerPlaceholders": "Per-shot prompt placeholders",
  "adminShotPrompt.composerValid":
    "Per-shot prompt includes all required placeholders.",
  "adminShotPrompt.defaultMode": "Using default prompt",
  "adminShotPrompt.description":
    "Manage the fixed site-wide prompt used when AI creates shot plans and each shot's composed prompt.",
  "adminShotPrompt.editor": "Fixed prompt",
  "adminShotPrompt.missingComposerPlaceholders":
    "Per-shot prompt is missing required placeholder(s): {placeholders}",
  "adminShotPrompt.missingPlaceholders":
    "Prompt is missing required placeholder(s): {placeholders}",
  "adminShotPrompt.placeholderHelp":
    "The prompt must include these placeholders so the backend can inject story, attributes, and shot duration.",
  "adminShotPrompt.placeholders": "Required placeholders",
  "adminShotPrompt.scenarioCustomMode":
    "Scenario analysis master prompt is customized",
  "adminShotPrompt.scenarioDefaultMode":
    "Scenario analysis master prompt is using the default",
  "adminShotPrompt.scenarioEditor": "Scenario analysis master prompt",
  "adminShotPrompt.scenarioHelp":
    "This prompt is the default instruction used when users analyze a scenario so AI can choose matching options.",
  "adminShotPrompt.scenarioRequired":
    "Scenario analysis master prompt is required.",
  "adminShotPrompt.save": "Save Shot Prompt",
  "adminShotPrompt.saved": "Shot Prompt saved",
  "adminShotPrompt.saveFailed": "Cannot save Shot Prompt",
  "adminShotPrompt.status": "Status",
  "adminShotPrompt.title": "Shot Prompt",
  "adminShotPrompt.updated": "Updated {date}",
  "adminShotPrompt.useDefault": "Use default",
  "adminShotPrompt.valid": "Prompt includes all required placeholders.",
  "adminMasterPrompt.builtInReadOnly":
    "Built-in default prompt is read-only. Create a new prompt to edit.",
  "adminMasterPrompt.builtInBadge": "Built-in",
  "adminMasterPrompt.content": "Prompt content",
  "adminMasterPrompt.outputFormat": "Output Format placeholder",
  "adminMasterPrompt.outputFormatHelp":
    "Optional instructions inserted only where this master prompt contains {outputFormat}. Leave it blank only when the prompt does not use that placeholder.",
  "adminMasterPrompt.defaultBadge": "Default",
  "adminMasterPrompt.defaultFailed": "Cannot set default",
  "adminMasterPrompt.defaultSaved": "Default saved",
  "adminMasterPrompt.delete": "Delete",
  "adminMasterPrompt.deleted": "Prompt deleted",
  "adminMasterPrompt.deleteDefaultBlocked":
    "Cannot delete the default prompt. Set another prompt as default first.",
  "adminMasterPrompt.deleteFailed": "Cannot delete prompt",
  "adminMasterPrompt.description":
    "Manage Story Content, Scenario and Shots master prompts. Each type has one active default prompt.",
  "adminMasterPrompt.edit": "Edit",
  "adminMasterPrompt.freeFormHelp":
    "Placeholders are supported and recommended per group, but they are not required to save. Runtime data is included only through placeholders in the selected prompt.",
  "adminMasterPrompt.listHelp":
    "This list only shows prompts for the selected Master Prompt child item.",
  "adminMasterPrompt.menuTitle": "Master Prompt",
  "adminMasterPrompt.name": "Prompt name",
  "adminMasterPrompt.newPrompt": "New prompt",
  "adminMasterPrompt.prompts": "Prompt list",
  "adminMasterPrompt.required": "Prompt name and content are required.",
  "adminMasterPrompt.save": "Save",
  "adminMasterPrompt.saved": "Prompt saved",
  "adminMasterPrompt.saveFailed": "Cannot save prompt",
  "adminMasterPrompt.selectPromptHelp":
    "Select Edit on a prompt or create a new prompt to open the editor.",
  "adminMasterPrompt.sections": "Master prompt groups",
  "adminMasterPrompt.setDefault": "Set default",
  "adminMasterPrompt.title": "Master Prompt",
  "adminLogs.description":
    "Inspect request/response metadata for AI calls without exposing secrets.",
  "adminLogs.latency": "Latency",
  "adminLogs.requestId": "Request ID",
  "adminLogs.requestLog": "Request/response log",
  "adminLogs.search": "Search request ID",
  "adminLogs.title": "AI Logs",
} as const;

export type TranslationKey = keyof typeof messages;
export type TranslationValues = Record<string, string | number>;

export function translate(key: TranslationKey, values?: TranslationValues) {
  let message: string = messages[key] ?? key;

  if (values) {
    for (const [name, value] of Object.entries(values)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }

  return message;
}
