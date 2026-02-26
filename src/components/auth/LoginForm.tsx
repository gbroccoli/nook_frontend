import {authApi} from '@/api/auth'
import {getHwid} from '@/lib/hwid'
import {useTranslation} from 'react-i18next'
import {Card, CardContent} from "@/components/ui/card.tsx";
import {Field, FieldDescription, FieldGroup, FieldLabel} from "@/components/ui/field.tsx";
import {Input} from "@/components/ui/Input.tsx";
import {Button} from "@/components/ui/Button.tsx";
import {zodResolver} from "@hookform/resolvers/zod"
import {Controller, useForm, useWatch} from "react-hook-form"
import z from "zod";
import {Link, useNavigate} from "react-router-dom";
import {useAuthStore} from "@/store/auth.ts";
import {useState} from "react";
import {Spinner} from "@/components/ui/spinner.tsx";
import {ApiError} from "@/api/client.ts";
import {toast} from "sonner";

const formLogin = z.object({
  username: z.string().lowercase(),
  password: z.string().min(8),
})

const LoginForm = () => {
  const {t} = useTranslation()

  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [loading, setLoading] = useState<boolean>(false)

  const form = useForm<z.infer<typeof formLogin>>({
    resolver: zodResolver(formLogin),
    defaultValues: {
      username: "",
      password: ""
    }
  })

  const [username, password] = useWatch({control: form.control, name: ['username', 'password']})
  const canSubmit = !!username && !!password

  const onSubmit = async (data: z.infer<typeof formLogin>) => {
    setLoading(true)

    try {
      const res = await authApi.login({
        username: data.username,
        password: data.password,
        hwid: getHwid(),
      })

      setAuth(res.user, res.access_token, res.refresh_token)
      navigate("/app")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error(t('common.errors.errorData'), {
          duration: 5000,

        })
      } else {
        toast.error(t('common.errors.serverError'), {

        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card className={"overflow-hidden p-0 bg-secondary border border-elevated rounded-2xl"}>
        <CardContent className={"grid p-0 md:grid-cols-2"}>
          <form className={"p-6 md:p-8"} onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <div className={"flex flex-col items-center gap-2 text-center"}>
                <h1 className={"text-2xl font-bold font-pixel text-text"}>{t('auth.login.title')}</h1>
                <p className={"text-muted-foreground text-balance"}>
                  {t('auth.login.subtitle')}
                </p>
              </div>
              <Controller
                name={"username"}
                control={form.control}
                render={({field, fieldState}) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      className={"text-sm font-medium text-text-secondary"}
                      htmlFor="username"
                    >
                      {t('common.fields.username')}
                    </FieldLabel>
                    <Input {...field} id={"username"} aria-invalid={fieldState.invalid} placeholder={"username"}
                           autoComplete={"off"}/>
                  </Field>
                )}
              />
              <Controller
                name={"password"}
                control={form.control}
                render={({field, fieldState}) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      className={"text-sm font-medium text-text-secondary"}
                      htmlFor={"password"}>
                      {t('common.fields.password')}
                    </FieldLabel>
                    <Input {...field} type={"password"} id={"password"} placeholder={"••••••••"}/>
                  </Field>
                )}
              />
              <Field>
                <Button disabled={!canSubmit || loading} type={"submit"}>
                  {loading && <Spinner />}
                  {t('auth.login.submit')}
                </Button>
              </Field>
              <FieldDescription className={"text-center"}>
                {t('auth.login.noAccount')}
                &nbsp;
                <Link
                  to={"/register"}
                  className={"text-primary hover:text-primary-hover transition-colors"}
                >
                  {t('auth.login.toRegister')}
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
    </>
  )
}

export default LoginForm

