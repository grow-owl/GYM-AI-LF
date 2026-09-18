import { NotificationType } from './notification.types';

export interface NotificationContent {
  title: string;
  body: string;
}

export const notificationTemplates = {
  [NotificationType.STREAK_MILESTONE]: (days: number): NotificationContent => ({
    title: `🔥 ${days}-Day Streak!`,
    body: `You've worked out ${days} days in a row. Keep up the amazing momentum!`,
  }),

  [NotificationType.BADGE_EARNED]: (badgeName: string): NotificationContent => ({
    title: '🏆 New Badge Unlocked!',
    body: `Congratulations! You just earned the "${badgeName}" badge. Check your profile to view it!`,
  }),

  [NotificationType.MEMBERSHIP_EXPIRING]: (daysLeft: number): NotificationContent => ({
    title: '⏰ Membership Expiring Soon',
    body: `Your gym membership expires in ${daysLeft} day(s). Renew now to avoid training interruption.`,
  }),

  [NotificationType.MEMBERSHIP_EXPIRING_7D]: (): NotificationContent => ({
    title: '⏰ Membership Expiring in 7 Days',
    body: 'Your gym membership expires in 7 days. Renew now to ensure uninterrupted training access.',
  }),

  [NotificationType.MEMBERSHIP_EXPIRING_3D]: (): NotificationContent => ({
    title: '⏰ Membership Expiring in 3 Days',
    body: 'Your gym membership expires in 3 days. Renew today at the desk or via the app!',
  }),

  [NotificationType.MEMBERSHIP_EXPIRING_1D]: (): NotificationContent => ({
    title: '⚠️ Membership Expiring Tomorrow',
    body: 'Your gym membership expires tomorrow! Renew now to avoid check-in disruption.',
  }),

  [NotificationType.MEMBERSHIP_EXPIRED]: (): NotificationContent => ({
    title: '🔴 Membership Expired',
    body: 'Your gym membership has expired. Please renew at the front desk or via app to resume gym check-ins.',
  }),

  [NotificationType.PAYMENT_DUE]: (amount?: number): NotificationContent => ({
    title: '💳 Membership Payment Due',
    body: `You have an outstanding payment${amount ? ` of ₹${amount}` : ''}. Please clear your dues to continue training.`,
  }),

  [NotificationType.MISSED_WORKOUT]: (daysMissed: number = 5): NotificationContent => ({
    title: '💪 We Miss You at the Gym!',
    body: `It's been ${daysMissed}+ days since your last gym check-in. Don't let your fitness goals slip!`,
  }),

  [NotificationType.PAYMENT_SUCCESS]: (amount: number, invoiceNo: string): NotificationContent => ({
    title: '✅ Payment Received',
    body: `Payment of ₹${amount} received successfully. Invoice #${invoiceNo}.`,
  }),

  [NotificationType.PAYMENT_FAILED]: (reason?: string): NotificationContent => ({
    title: '❌ Payment Failed',
    body: `Your payment transaction could not be completed. ${reason || 'Please update payment details and retry.'}`,
  }),

  [NotificationType.WORKOUT_ASSIGNED]: (planTitle: string): NotificationContent => ({
    title: '📋 New Workout Plan Assigned',
    body: `Your personal trainer assigned you a new workout plan: "${planTitle}". Check it out now!`,
  }),

  [NotificationType.AI_REPORT_READY]: (reportType: string): NotificationContent => ({
    title: '📊 AI Coach Report Ready',
    body: `Your ${reportType.toLowerCase()} AI performance report is ready with fresh insights and recommendations.`,
  }),

  [NotificationType.CHALLENGE_INVITE]: (challengeTitle: string): NotificationContent => ({
    title: '🎯 New Gym Challenge Announced',
    body: `Join the "${challengeTitle}" challenge now to earn bonus XP and climb the leaderboard!`,
  }),

  [NotificationType.PASSWORD_RESET]: (): NotificationContent => ({
    title: '🔐 Password Reset Requested',
    body: 'A password reset link was generated for your account. If you did not request this, please secure your account immediately.',
  }),

  [NotificationType.TRAINER_MESSAGE]: (trainerName: string): NotificationContent => ({
    title: `💬 Message from ${trainerName}`,
    body: 'Your trainer sent you an update regarding your training routine.',
  }),

  [NotificationType.WELCOME_NEW_MEMBER]: (memberName: string, gymName: string): NotificationContent => ({
    title: `🎉 Welcome to ${gymName}!`,
    body: `Welcome to ${gymName}, ${memberName}! 💪 Hum ready hain aapke fitness goals achieve karne mein help karne ke liye. App check karein!`,
  }),

  [NotificationType.RENEWAL_DISCOUNT_OFFER]: (discountPercent: string = '20%', validTill: string = '3 days'): NotificationContent => ({
    title: '🎁 Special Renewal Offer Just for You!',
    body: `We miss seeing you at the gym! Aaj hi membership renew karein and paayein ${discountPercent} OFF! Offer valid for ${validTill}.`,
  }),

  [NotificationType.REFERRAL_ASK]: (memberName: string, referralCodeOrLink: string): NotificationContent => ({
    title: '🏋️ Bring a Gym Buddy & Win Perks!',
    body: `Hey ${memberName}! Friends ke saath workout karo and rewards paao. Share your referral code: ${referralCodeOrLink}`,
  }),

  [NotificationType.BIRTHDAY_WISH]: (memberName: string, gymName: string): NotificationContent => ({
    title: '🎉 Happy Birthday from All of Us! 🎂',
    body: `Happy Birthday ${memberName}! 🎂 Wishing you strength and health from the entire ${gymName} team! Have a great day!`,
  }),

  [NotificationType.NEW_MEMBER_ASSIGNED]: (memberName: string): NotificationContent => ({
    title: '👤 New Member Assigned',
    body: `${memberName} has been assigned to you as a new member. Check their profile and set up their first workout plan!`,
  }),

  [NotificationType.PLATFORM_UPGRADE_REQUESTED]: (gymName: string, currentPlan: string, requestedPlan: string): NotificationContent => ({
    title: '🚀 Platform Plan Upgrade Requested',
    body: `${gymName} requested a plan change from ${currentPlan} to ${requestedPlan}.`,
  }),

  [NotificationType.GENERIC]: (title: string, body: string): NotificationContent => ({
    title,
    body,
  }),
};
