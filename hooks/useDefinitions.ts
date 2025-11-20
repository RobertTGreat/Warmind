import useSWR from 'swr';
import { bungieApi, endpoints } from '@/lib/bungie';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

export function usePresentationNode(hash: number | undefined) {
  const { data, error, isLoading } = useSWR(
    hash ? endpoints.getPresentationNodeDefinition(hash) : null,
    fetcher
  );
  return {
    node: data?.Response,
    isLoading,
    isError: error
  };
}

export function useCollectible(hash: number | undefined) {
  const { data, error, isLoading } = useSWR(
    hash ? endpoints.getCollectibleDefinition(hash) : null,
    fetcher
  );
  return {
    collectible: data?.Response,
    isLoading,
    isError: error
  };
}

export function useRecord(hash: number | undefined) {
  const { data, error, isLoading } = useSWR(
    hash ? endpoints.getRecordDefinition(hash) : null,
    fetcher
  );
  return {
    record: data?.Response,
    isLoading,
    isError: error
  };
}

