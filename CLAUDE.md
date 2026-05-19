# MEMOÍ Admin Dashboard

## Project Overview
This is an internal admin dashboard for MEMOÍ, an e-commerce fashion brand. The dashboard provides comprehensive store management capabilities including order fulfillment, inventory tracking, exchange request management, and customer analytics.

## Tech Stack
- **Framework**: Next.js 16.2.1 (App Router)
- **UI Library**: NextUI 2.6.11 (React component library with dark theme)
- **Database**: Supabase (PostgreSQL)
- **State Management**: TanStack Query (React Query) 5.95.2
- **Styling**: Tailwind CSS 3.4.1
- **Email**: Resend 6.12.2
- **Charts**: Recharts 3.8.1
- **Icons**: Lucide React 1.7.0
- **Date Handling**: date-fns 4.1.0
- **Animation**: Framer Motion 12.38.0

## Key Features

### 1. Dashboard (Home)
- **Location**: `app/page.tsx`
- Revenue metrics for last 30 days
- Total orders count
- Pending exchanges alert
- Low stock items warning
- 14-day revenue trend chart
- Real-time data from Supabase

### 2. Order Management
- **Location**: `app/orders/page.tsx`
- Bulk order fulfillment with EasyParcel API integration
- Search by order number, email, or tracking number
- Date range filtering
- Order details modal with line items
- Tracking link and label generation
- Customer tier badges (Gold/Member)
- Automatic email notifications on fulfillment

### 3. Exchange Requests
- **Location**: `app/exchanges/page.tsx`
- View all exchange requests
- Filter by status (Pending/All)
- One-click status updates (Pending → Approved/Rejected/Completed)
- Real-time database updates via mutations
- Dropdown action menu for quick status changes

### 4. Inventory Management
- **Location**: `app/inventory/page.tsx`
- Product variant tracking by size
- Inline stock editing (click-to-edit)
- Low stock alerts (< 5 units)
- Filter view for low stock items
- Real-time stock updates
- Price display in SGD format

### 5. Customer Analytics
- **Location**: `app/customers/page.tsx`
- Total member count
- New signups (30-day tracking)
- Loyalty tier distribution pie chart
- Searchable customer directory
- Lifetime value (LTV) tracking
- Join date and tier information

## Critical Components

### Sidebar Navigation
- **Location**: `components/Sidebar.tsx`
- Responsive navigation (hidden on mobile)
- Active route highlighting
- Icons from Lucide React

### Page Header
- **Location**: `components/PageHeader.tsx`
- Consistent header across all pages
- Refresh button for manual data reload
- Uses React Query's query invalidation

## API Integrations

### EasyParcel Integration
- **Location**: `actions/easyparcel.ts`
- **Base URL**: `https://connect.easyparcel.sg/?ac=`
- **Functions**:
  - `processBulkFulfillment()`: Books shipping labels for selected orders
  - `getFulfillmentPreview()`: Calculates shipping costs before fulfillment
- **Features**:
  - Dynamic address resolution (waterfall from shipping → billing → user data)
  - Automatic rate checking for cheapest pickup service
  - Credit balance validation
  - Label URL and tracking URL generation
  - Vietnamese tone removal for international shipping
  - Hardcoded package dimensions: 37cm × 26cm × 10cm
  - Default sender address: 271B Joo Chiat Road, Singapore 427525

### Email Service
- **Location**: `lib/EmailService.ts`
- **Provider**: Resend API
- Branded HTML email templates
- Order tracking notifications
- MEMOÍ branding with logo and social links

## Database Schema (Supabase)

### Tables Used:
1. **orders**
   - `id`, `order_number`, `total`, `currency`, `status`
   - `email`, `phone_number`, `created_at`, `updated_at`
   - `shipping_address_line_1`, `shipping_city`, `shipping_state`, `shipping_zip_postal_code`, `shipping_country`
   - `awb` (Air Waybill number), `awb_tracking_url`, `awb_label_url`
   - `exchange_request_status` (Pending, Approved, Rejected, Completed)
   - Foreign keys: `user_id`

2. **order_items**
   - `id`, `product_name`, `size`, `color`, `quantity`, `unit_price`
   - Foreign key: `order_id`

3. **products**
   - `id`, `name`, `sku`, `status`, `created_at`

4. **product_variants**
   - `id`, `size`, `stock`, `price`
   - Foreign key: `product_id`

5. **users**
   - `id`, `first_name`, `last_name`, `email`, `phone_number`
   - `address`, `city`, `state`, `zip_code`, `country`
   - `tier_name` (Member, Gold)
   - `current_spending`, `created_at`

6. **billing_info**
   - `first_name`, `last_name`, `phone_number`
   - `address`, `city`, `state`, `zip_code`, `country`
   - Foreign key: `order_id`

## Environment Variables (.env)
```
NEXT_PUBLIC_SUPABASE_URL=https://api.memoiofficial.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=[JWT token]
EP_API_KEY=[EasyParcel API key]
ADMIN_USERNAME=admin
ADMIN_PASSWORD=[redacted]
RESEND_SECRET=[Resend API key]
EMAIL_FROM_ADDRESS="MEMOÍ <no-reply@notifications.memoiofficial.com>"
```

## Authentication & Security

### HTTP Basic Auth
- **Location**: `middleware.ts`
- Protects all dashboard routes
- Browser-native login prompt
- Credentials stored in environment variables
- Bypasses Next.js assets and API routes

## Styling & Theme
- **Dark mode** by default (set in `app/layout.tsx`)
- **Font**: Inter (Google Fonts)
- **Color Scheme**: NextUI default dark theme
  - Primary: Blue (#006FEE)
  - Success: Green
  - Warning: Orange
  - Danger: Red
- **Responsive**: Mobile-first design with md/lg breakpoints

## Development Commands
```bash
npm run dev    # Start development server on localhost:3000
npm run build  # Production build
npm start      # Start production server
npm run lint   # Run ESLint
```

## Important Notes

### EasyParcel Workflow
1. User selects orders in the Orders table
2. System checks EasyParcel credit balance
3. Live rate calculation based on destination zip codes
4. User confirms purchase with cost preview
5. System executes: Rate Check → Submit Order → Pay Order
6. AWB and tracking links stored in database
7. Customer receives automated tracking email

### Data Flow
- All data queries use React Query for caching and real-time updates
- Mutations automatically invalidate relevant queries
- Supabase client initialized in `lib/supabase.ts`
- Server actions marked with `"use server"` directive

### UI/UX Patterns
- **Inline Editing**: Click-to-edit stock numbers in inventory
- **Optimistic Updates**: UI updates before database confirmation
- **Debounced Search**: 400ms delay to reduce API calls
- **Pagination**: 10 rows per page across all tables
- **Hydration Safety**: Client-side rendering checks with `isClient` state

### Known Issues (from comments in code)
- Order fulfillment now uses synchronous execution (blocking modal)
- Vietnamese character handling for international shipping

## File Structure
```
├── actions/
│   └── easyparcel.ts          # EasyParcel API integration
├── app/
│   ├── layout.tsx             # Root layout with Sidebar
│   ├── page.tsx               # Dashboard home
│   ├── providers.tsx          # NextUI + React Query providers
│   ├── customers/page.tsx     # Customer analytics
│   ├── exchanges/page.tsx     # Exchange request management
│   ├── inventory/page.tsx     # Inventory tracking
│   └── orders/page.tsx        # Order fulfillment
├── components/
│   ├── PageHeader.tsx         # Reusable page header
│   └── Sidebar.tsx            # Navigation sidebar
├── lib/
│   ├── EmailService.ts        # Email notification service
│   └── supabase.ts            # Supabase client
├── middleware.ts              # Basic auth middleware
└── .env                       # Environment variables
```

## Design Philosophy
- **Admin-first**: Optimized for internal operations team
- **Speed**: Instant feedback with optimistic updates
- **Clarity**: Clear status indicators and visual hierarchy
- **Efficiency**: Bulk operations and keyboard shortcuts
- **Safety**: Confirmation modals for destructive actions

@AGENTS.md
