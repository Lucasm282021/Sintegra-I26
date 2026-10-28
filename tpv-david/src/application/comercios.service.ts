import { Comercio, esComercioInputValido, NuevoComercioInput } from "../domain/comercio";
import { UpstreamNotRegisteredError, ValidationError } from "../domain/errors";
import { ComercioRepository } from "../infrastructure/comercio.repository";
import { MunicipioClient } from "../infrastructure/municipio.client";

export class ComerciosService {
  constructor(
    private readonly repo: ComercioRepository,
    private readonly municipioClient: MunicipioClient
  ) {}

  // Da de alta un comercio por CUIT. Consulta la habilitación municipal:
  // si no está habilitado, no lo guarda y avisa — el TPV no vende con un
  // comercio no habilitado.
  async crear(input: NuevoComercioInput): Promise<Comercio> {
    const error = esComercioInputValido(input);
    if (error) throw new ValidationError(error);

    const habilitacion = await this.municipioClient.consultarHabilitacion({ cuit: input.cuit });
    if (!habilitacion.habilitado) {
      throw new UpstreamNotRegisteredError(
        `el cuit ${input.cuit} no está habilitado por el Municipio: no se puede vender con este comercio`
      );
    }

    const comercio: Comercio = {
      cuit: input.cuit,
      razonSocial: input.razonSocial,
      rubro: habilitacion.rubro,
      habilitado: true,
      verificadoEn: new Date().toISOString(),
    };
    return this.repo.save(comercio);
  }

  async listar(): Promise<Comercio[]> {
    return this.repo.findAll();
  }
}