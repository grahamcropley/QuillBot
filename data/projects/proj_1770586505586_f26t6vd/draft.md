# The Hidden Costs of DIY Voice in Microsoft Teams

**Why many organizations are rethinking Direct Routing on-prem and choosing Operator Connect**

## Executive summary

Microsoft Teams has become the backbone of unified communication. When it comes to external voice, many organizations take the Do‑It‑Yourself path using Direct Routing because it appears flexible and cost effective. In reality, DIY voice introduces hidden costs in engineering effort, compliance, emergency calling, number management, and multi‑country scaling. **Operator Connect** provides a simpler, carrier‑managed route with faster deployment, transparent administration in the Teams admin center (TAC), and reliability backed by shared SLAs. For most enterprises, this means lower operational overhead and greater predictability.

## How Teams Phone connects to the Public Switched Telephone Network (PSTN)

Microsoft Teams supports four primary PSTN models:

- **Calling Plans** where Microsoft is your carrier. Simple and fast in available countries.  
  [Calling Plans overview](https://learn.microsoft.com/en-us/microsoftteams/calling-plans-for-office-365) • [Country and region availability](https://learn.microsoft.com/en-us/MicrosoftTeams/calling-plan-overview)
- **Operator Connect** where a participating carrier manages SBCs and interconnect with you. You enable the operator and assign numbers in the Teams admin center.  
  [Plan for Operator Connect](https://learn.microsoft.com/en-us/microsoftteams/operator-connect-plan)
- **Direct Routing** where you connect and operate your own certified SBCs, trunks, and routing policies. Maximum flexibility, highest operational responsibility.  
  [Plan Direct Routing](https://learn.microsoft.com/en-us/microsoftteams/direct-routing-plan)
- **Teams Phone Mobile** where mobile numbers are integrated directly into Teams, allowing users to make and receive calls using their existing mobile number in Teams. This is ideal for organisations that want a single identity across mobile and Teams, with carrier integration for seamless calling.  
  [Plan for Teams Phone Mobile](https://learn.microsoft.com/en-us/microsoftteams/operator-connect-mobile-plan)

## Burdening your team

Building a DIY voice deployment means selecting, certifying, operating, and monitoring Session Border Controllers (SBCs), designing voice routing, and coordinating carriers across regions. Your engineers become responsible for TLS certificate trust, mTLS changes, and ongoing health checks. This is not a one‑time project, it is a continuing operational commitment.

**What this looks like day to day**

- Designing and maintaining **voice routing policies** and PSTN usages for number patterns and failovers.
- Enabling users and managing **licenses, DDI assignment, and TeamsOnly mode**, especially during migrations.
- Monitoring SBC health using **SIP options**, coordinating with vendors, and responding to incidents.
- Supporting end users with various **voice issues** from carriers, SBCs, and end user devices.
- Moves, adds, and changes in **Call Queues** and **Auto Attendants** to adapt to business changes.

## Hidden price tag

DIY is not just infrastructure. It is people. Every hour your IT team spends firefighting voice issues is an hour lost on strategic work. Unplanned downtime, compliance tasks, and unpredictable carrier variations all add cost.

**Where costs typically hide**

- **Emergency calling configuration** requires validated addresses, dynamic location mapping, and policy-based security desk notifications, with regional differences to consider.
- **Recording and compliance** require separating convenience recording from policy-based compliance recording, choosing certified partners, and governing storage and retention.
- **Number lifecycle management** spans acquisition, porting, assignment, and usage type changes, plus hybrid AD attributes in some environments.
- **Data residency** needs clear documentation of where Teams chat, media, and recordings are stored, and whether ADR or Multi-Geo commitments apply to your tenant.
- **Call flow changes**: as your business adapts to your customers’ needs, Call Queues and Auto Attendants will need to be maintained.
- **Teams Phone policies**: not just voice routing—there are other Teams Phone policies that need to be maintained and tweaked so they are effective.

The cheap option starts to look very expensive once you take into account all of the hidden costs and daily strain on your IT team during the lifetime of your phone system.

## Smarter alternative

Having the right certified partner that can deliver scalable and reliable voice into Microsoft Teams matters. **Operator Connect** simplifies deployment and operations while preserving control in the Teams admin center.

**You can expect**

- **Predictable costs** that make sense with economies of scale.
- **Best in class global coverage** without carrier headaches.
- **Powerful admin portal** for real-time provisioning, number management, and analytics.  
  _(Portal capabilities are provided by LoopUp and enhance and complement native Teams Admin Center.)_
- **Built-in compliance posture** for emergency calling and data sovereignty, with guidance for regulated recording.
- **Expert support** so your team focuses on innovation, not troubleshooting.

## When DIY still makes sense

Direct Routing can still be the right choice if you need deep interop with third‑party PBX, analog devices, or complex contact center integrations, or if you need bespoke routing topologies. Many enterprises use a mixed model with Direct Routing for special cases and Operator Connect for the rest.

## Global considerations you should not skip

- **Audio conferencing numbers** and dial-in behavior vary by region. Operator Connect Conferencing allows you to bring operator numbers to your bridge.
- **Licensing clarity** for end users, shared devices, and voice applications prevents misconfiguration later.
- **Certificate trust updates** for SBCs can be required over time. Plan for periodic validation and vendor guidance.
- **Local telco regulations** will determine if you need to have physical SBCs deployed in-country to be compliant.
- **Direct Routing-only countries** such as China, where Microsoft has not rolled out Operator Connect, are something to bear in mind. However, providers can offer **Direct Routing as a Service** models in these locations to negate the use of on-prem equipment and keep infrastructure in the cloud.

## Migration roadmap: DIY to Operator Connect

If you’re already on your Teams Phone journey, don’t worry. Direct Routing and Operator Connect can coexist with one another inside your Office 365 tenant, and in some use cases will need to. It is not complex to migrate from your Direct Routing solution to Operator Connect. Here is a high-level migration roadmap to follow:

**Phase 1. Readiness and design**  
Confirm your chosen Operator Connect provider has the capabilities to deliver full cloud replacement services in the countries you desire.

**Phase 2. Numbers and emergency addresses**  
Purchase new or port numbers with the operator so they appear in Teams Admin Center. Associate emergency addresses according to operator capabilities where applicable.

**Phase 3. Policies and compliance**  
Align calling, meeting, and recording policies. Implement dynamic emergency calling and security desk notifications where required.

**Phase 4. Pilot and scale**  
Pilot a site. Validate call quality, number assignments, and support paths. Scale region by region.

**Phase 5. Business as Usual**  
Use ongoing analytics to reduce cost and improve support for your end users.

## Evaluation matrix

Below is an evaluation matrix that can be used to quickly identify which PSTN connectivity method best fits your organization.

| Criteria               | Calling Plans                           | Operator Connect                                                              | Direct Routing (DIY)                                                                           | Teams Phone Mobile                                 |
| ---------------------- | --------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Coverage               | Available in select countries only      | Global coverage via participating operators                                   | Requires local carrier relationships                                                           | Depends on mobile operator partnerships            |
| Cost predictability    | High subscription per user              | Pricing shared by operators                                                   | Variable (SBC, carrier fees, maintenance)                                                      | High (integrated mobile plan pricing)              |
| Compliance             | Microsoft handles compliance            | Built-in compliance with operator support                                     | Requires manual configuration for emergency calling and recording, plus local telco compliance | Compliance handled by mobile operator and Teams    |
| Interoperability       | Limited (no external PBX integration)   | Operators offer integrations (analogue, contact center, call recording, etc.) | Supports PBX, analogue, contact center, call recording, etc.                                   | Limited (focused on mobile identity)               |
| Operational complexity | Microsoft manages support, etc.         | Operator manages SBCs and support                                             | You manage SBCs, routing, certificates, configuration, support                                 | Managed by operator                                |
| Scalability            | Moderate (limited to available regions) | Scales globally with operator                                                 | Complex to manage                                                                              | Scales with mobile operator footprint              |
| Ideal use cases        | Deployments in supported regions        | Enterprises seeking global coverage, simplicity, and integrations             | Organizations needing PBX/analog interop or custom routing                                     | Mobile-first organizations wanting single identity |

## Conclusion

DIY voice in Teams gives you deep control but demands sustained engineering effort and rigorous compliance work. Operator Connect provides simpler, faster deployment with carrier‑managed infrastructure and reliable interconnects, while still allowing you to manage numbers and policies centrally within the Teams Admin Center. For most organizations, this reduces risk, compresses timelines, and frees your team to focus on higher value projects.
