import {Card, CardContent} from "@/components/ui/card.tsx";
import {Field, FieldDescription, FieldGroup, FieldLabel} from "@/components/ui/field.tsx";
import {useTranslation} from "react-i18next";
import type {TFunction} from "i18next";
import {Input} from "@/components/ui/Input.tsx";
import {Button} from "@/components/ui/Button.tsx";
import {Link, useNavigate} from "react-router-dom";
import {zodResolver} from "@hookform/resolvers/zod"
import {Controller, useForm, useWatch} from "react-hook-form"
import z from "zod";
import {useState} from "react";
import {Spinner} from "@/components/ui/spinner.tsx";
import {authApi} from "@/api/auth.ts";
import {getHwid} from "@/lib/hwid.ts";
import {useAuthStore} from "@/store/auth.ts";
import {ApiError} from "@/api/client.ts";
import {toast} from "sonner";

const createSchema = (t: TFunction) => z.object({
  username: z.string()
    .min(3, t('auth.validation.usernameMin'))
    .regex(/^[a-z0-9_]+$/, t('auth.validation.usernameFormat')),
  displayName: z.string()
    .min(1, t('auth.validation.displayNameRequired')),
  password: z.string()
    .min(8, t('auth.validation.passwordMin')),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: t('auth.validation.passwordMatch'),
  path: ['confirmPassword'],
})

const RegisterForm = () => {
  const {t} = useTranslation()

  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    resolver: (data, context, options) =>
      zodResolver(createSchema(t))(data, context, options),
    defaultValues: {username: '', displayName: '', password: '', confirmPassword: ''},
  })

  const [username, displayName, password, confirmPassword] = useWatch({
    control: form.control,
    name: ['username', 'displayName', 'password', 'confirmPassword'],
  })
  const canSubmit = !!username && !!displayName && !!password && !!confirmPassword

  type FormValues = z.infer<ReturnType<typeof createSchema>>
  const onSubmit = async (data: FormValues) => {
    setLoading(true)
    try {
      const res = await authApi.register({
        username: data.username,
        display_name: data.displayName,
        password: data.password,
        hwid: getHwid()
      })
      setAuth(res.user, res.access_token, res.refresh_token)
      navigate('/app')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError('username', {
          message: t('auth.register.errors.usernameTaken')
        })
      } else {
        toast.error(t('common.errors.serverError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={"overflow-hidden p-0 bg-secondary border border-elevated rounded-2xl"}>
      <CardContent className={"grid p-0 md:grid-cols-2"}>
        <form className={"p-6 md:p-8"} onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className={"flex flex-col items-center gap-2 text-center"}>
              <h1 className={"text-2xl font-bold font-pixel text-text"}>{t('auth.register.title')}</h1>
              <p className={"text-muted-foreground text-balance"}>
                {t('auth.register.subtitle')}
              </p>
            </div>
            <Controller
              name={"username"}
              control={form.control}
              render={({field, fieldState}) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className={"text-sm font-medium text-text-secondary"} htmlFor={"username"}>
                    {t('common.fields.username')}
                  </FieldLabel>
                  <Input {...field} id={"username"} placeholder={"alice"}
                         onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}/>
                  <FieldDescription className={`text-xs ${fieldState.error ? 'text-error' : 'text-text-disabled'}`}>
                    {fieldState.error?.message ?? t('common.hints.usernameFormat')}
                  </FieldDescription>
                </Field>
              )}
            />
            <Controller
              name={"displayName"}
              control={form.control}
              render={({field, fieldState}) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className={"text-sm font-medium text-text-secondary"} htmlFor={"displayName"}>
                    {t('common.fields.displayName')}
                  </FieldLabel>
                  <Input {...field} id={"displayName"} placeholder={"Alice"}/>
                  {fieldState.error && (
                    <FieldDescription className={"text-xs text-error"}>{fieldState.error.message}</FieldDescription>
                  )}
                </Field>
              )}
            />
            <Controller
              name={"password"}
              control={form.control}
              render={({field, fieldState}) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className={"text-sm font-medium text-text-secondary"} htmlFor={"password"}>
                    {t('common.fields.password')}
                  </FieldLabel>
                  <Input {...field} id={"password"} type={"password"} placeholder={"••••••••"}/>
                  {fieldState.error && (
                    <FieldDescription className={"text-xs text-error"}>{fieldState.error.message}</FieldDescription>
                  )}
                </Field>
              )}
            />
            <Controller
              name={"confirmPassword"}
              control={form.control}
              render={({field, fieldState}) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className={"text-sm font-medium text-text-secondary"} htmlFor={"confirmPassword"}>
                    {t('common.fields.confirmPassword')}
                  </FieldLabel>
                  <Input {...field} id={"confirmPassword"} type={"password"} placeholder={"••••••••"}/>
                  {fieldState.error && (
                    <FieldDescription className={"text-xs text-error"}>{fieldState.error.message}</FieldDescription>
                  )}
                </Field>
              )}
            />
            <Field>
              <Button type={"submit"} disabled={!canSubmit || loading}>
                {loading && <Spinner />}
                {t('auth.register.submit')}
              </Button>
            </Field>
            <FieldDescription className={"text-center"}>
              {t('auth.login.noAccount')}
              &nbsp;
              <Link
                to={"/login"}
                className={"text-primary hover:text-primary-hover transition-colors"}
              >
                {t('auth.register.toLogin')}
              </Link>
            </FieldDescription>
          </FieldGroup>
        </form>
        <div className="bg-muted relative hidden md:block">
          <img
            src="/login_bg.webp"
            alt="Image"
            className="absolute inset-0 h-full w-full object-cover object-right dark:brightness-[0.2] dark:grayscale pointer-events-none"
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default RegisterForm
